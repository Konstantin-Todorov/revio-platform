import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

vi.mock("server-only", () => ({}));
const io = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  transaction: vi.fn(),
  accrue: vi.fn(),
  audit: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("@revio/db", () => ({
  forTenant: () => io.db,
  withTenantTransaction: (...args: unknown[]) => io.transaction(...args),
}));
vi.mock("./folio", () => ({
  folioBalance: () => ({ balance: 0 }),
  accrueStayExtras: (...args: unknown[]) => io.accrue(...args),
}));
vi.mock("./mutation-helpers", () => ({
  logAudit: (...args: unknown[]) => io.audit(...args),
  recordSync: (...args: unknown[]) => io.sync(...args),
}));

import { DayAlreadyClosedError, runCloseDay } from "./close-day-run";

type State = { date: Date | null; noShow: boolean; charges: string[]; audits: string[] };
let state: State;
let autoEnabled: boolean;
let failAt: "no-show" | "accrual" | "audit" | null;
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const actor = { kind: "user", userId: "staff" } as const;

// Explicit state snapshots model rollback. Dependencies write through the client they receive;
// a helper accidentally using the outer client therefore leaks a write and fails these tests.
function client(read: () => State) {
  return {
    property: {
      findUnique: vi.fn(async () => ({ id: "property", timezone: "UTC", businessDate: read().date })),
      updateMany: vi.fn(async ({ where, data }: { where: { businessDate: Date | null }; data: { businessDate: Date } }) => {
        if (read().date?.getTime() !== where.businessDate?.getTime()) return { count: 0 };
        read().date = data.businessDate;
        return { count: 1 };
      }),
    },
    propertyDefaults: { findUnique: vi.fn(async () => ({ autoCloseEnabled: autoEnabled, closeDeadlineMinutes: 30, closeReminderWindowHours: 22 })) },
    folio: { findMany: vi.fn(async () => []) },
    roomAssignment: { count: vi.fn(async () => 0) },
    reservation: {
      findMany: vi.fn(async () => read().noShow ? [] : [{ id: "reservation", lines: [{ checkIn: day("2026-09-07") }], assignments: [] }]),
      update: vi.fn(async () => {
        read().noShow = true;
        if (failAt === "no-show") throw new Error("injected no-show failure");
      }),
    },
    folioLine: { create: vi.fn(async ({ data }: { data: { ref: string } }) => { read().charges.push(data.ref); }) },
    auditEntry: { create: vi.fn(async ({ data }: { data: { field: string } }) => { read().audits.push(data.field); }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  state = { date: day("2026-09-07"), noShow: false, charges: [], audits: [] };
  autoEnabled = true;
  failAt = null;
  io.db = client(() => state);
  // Serial transactions also exercise stale intent when the next caller reaches the DB after commit.
  let tail = Promise.resolve();
  io.transaction.mockImplementation(async (_tenant: string, fn: (tx: ReturnType<typeof client>) => Promise<unknown>) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const working = structuredClone(state);
    try {
      const result = await fn(client(() => working));
      state = working;
      return result;
    } finally { release(); }
  });
  io.accrue.mockImplementation(async (_tenant: string, _property: string, date: string, db: ReturnType<typeof client>) => {
    await db.folioLine.create({ data: { ref: `breakfast:${date}` } });
    if (failAt === "accrual") throw new Error("injected accrual failure");
    await db.folioLine.create({ data: { ref: `parking:${date}` } });
    return 2;
  });
  io.audit.mockImplementation(async (_property: string, _tenant: string, entry: { field: string }, db: ReturnType<typeof client>) => {
    await db.auditEntry.create({ data: entry });
    if (failAt === "audit") throw new Error("injected audit failure");
  });
  io.sync.mockResolvedValue(undefined);
});

describe("Close Day intent and atomicity", () => {
  it("refuses a second September 7 submission without closing September 8", async () => {
    await runCloseDay("tenant", "property", actor, "2026-09-07");
    await expect(runCloseDay("tenant", "property", actor, "2026-09-07")).rejects.toBeInstanceOf(DayAlreadyClosedError);
    expect(state.date).toEqual(day("2026-09-08"));
    expect(state.audits).toEqual(["2026-09-07"]);
    expect(state.charges).toHaveLength(2);
  });

  it("allows an explicitly selected next overdue day for catch-up", async () => {
    await runCloseDay("tenant", "property", actor, "2026-09-07");
    await runCloseDay("tenant", "property", actor, "2026-09-08");
    expect(state.audits).toEqual(["2026-09-07", "2026-09-08"]);
  });

  it("admits one of two overlapping manual/scheduled intents", async () => {
    const results = await Promise.allSettled([
      runCloseDay("tenant", "property", actor, "2026-09-07"),
      runCloseDay("tenant", "property", { kind: "system" }, "2026-09-07"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.charges).toHaveLength(2);
  });

  it.each(["no-show", "accrual", "audit"] as const)("rolls back a %s failure and retries the same night exactly once", async (boundary) => {
    failAt = boundary;
    await expect(runCloseDay("tenant", "property", actor, "2026-09-07")).rejects.toThrow("injected");
    expect(state).toEqual({ date: day("2026-09-07"), noShow: false, charges: [], audits: [] });
    expect(io.sync).not.toHaveBeenCalled();
    failAt = null;
    await runCloseDay("tenant", "property", actor, "2026-09-07");
    expect(state.charges).toEqual(["breakfast:2026-09-07", "parking:2026-09-07"]);
    expect(state.audits).toEqual(["2026-09-07"]);
  });

  it("does not turn a committed close into a failure if the post-commit sync cannot run", async () => {
    io.sync.mockRejectedValue(new Error("injected delivery failure"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(runCloseDay("tenant", "property", actor, "2026-09-07")).resolves.toMatchObject({ businessDate: "2026-09-07", noShows: 1 });
    expect(state.audits).toEqual(["2026-09-07"]);
  });

  it("rechecks automatic eligibility rather than trusting the sweep's earlier snapshot", async () => {
    autoEnabled = false;
    expect(await runCloseDay("tenant", "property", { kind: "system" }, "2026-09-07")).toBeNull();
    expect(state.date).toEqual(day("2026-09-07"));
    expect(io.accrue).not.toHaveBeenCalled();
  });

  it("never automatically closes a current day", async () => {
    state.date = day("2026-09-09");
    expect(await runCloseDay("tenant", "property", { kind: "system" }, "2026-09-09")).toBeNull();
    expect(state.audits).toEqual([]);
  });

  it("binds the initial null business date to the day shown", async () => {
    state.date = null;
    await runCloseDay("tenant", "property", actor, "2026-09-09");
    await expect(runCloseDay("tenant", "property", actor, "2026-09-09")).rejects.toBeInstanceOf(DayAlreadyClosedError);
    expect(state.date).toEqual(day("2026-09-10"));
  });

  it.each(["", "2026-02-30", "not-a-date"])("refuses invalid intent %s without writing", async (date) => {
    await expect(runCloseDay("tenant", "property", actor, date)).rejects.toThrow();
    expect(state.audits).toEqual([]);
    expect(io.accrue).not.toHaveBeenCalled();
  });
});
