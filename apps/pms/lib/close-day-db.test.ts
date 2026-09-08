import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantTx } from "@revio/db";

// Opt-in only. Use a migrated, disposable local database and a restricted (non-BYPASSRLS) role:
// CLOSE_DAY_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/close_day_verify_utf8
// DATABASE_URL=<same URL> DIRECT_DATABASE_URL=<same URL>
// pnpm --filter @revio/pms test -- lib/close-day-db.test.ts
const enabled = Boolean(process.env.CLOSE_DAY_TEST_DATABASE_URL);
if (enabled) {
  const url = new URL(process.env.CLOSE_DAY_TEST_DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/close_day_verify_utf8" ||
      process.env.DATABASE_URL !== url.href || process.env.DIRECT_DATABASE_URL !== url.href) {
    throw new Error("Close Day DB tests require the explicitly named disposable loopback database in all three URLs.");
  }
}

const control = vi.hoisted(() => ({
  boundary: null as "posting" | "accrual" | "audit" | null,
  afterRead: null as (() => Promise<void>) | null,
  push: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: new Proxy({}, { get() { throw new Error("Session DB proxy used by Close Day"); } }) }));
vi.mock("./data", () => ({ activeProperty: vi.fn() }));
vi.mock("./session", () => ({ getSession: async () => null }));
vi.mock("@revio/connectivity", () => ({ syncRealChannels: control.push }));
vi.mock("@revio/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@revio/db")>();
  return { ...original, withTenantTransaction: <T>(tenant: string, fn: (tx: TenantTx) => Promise<T>) =>
    original.withTenantTransaction(tenant, async (tx) => {
      // Force two separate DB transactions to read D before either tries the conditional roll.
      const property = new Proxy(tx.property, { get(target, key) {
        if (key === "findUnique") return async (...args: Parameters<typeof target.findUnique>) => {
          const result = await target.findUnique(...args);
          await control.afterRead?.();
          return result;
        };
        return Reflect.get(target, key);
      } });
      return fn(new Proxy(tx, { get(target, key) { return key === "property" ? property : Reflect.get(target, key); } }));
    }),
  };
});
vi.mock("./folio", async (importOriginal) => {
  const original = await importOriginal<typeof import("./folio")>();
  return { ...original, accrueStayExtras: async (...args: Parameters<typeof original.accrueStayExtras>) => {
    const result = await original.accrueStayExtras(...args);
    if (control.boundary === "accrual") throw new Error("injected after actual accrual");
    return result;
  } };
});
vi.mock("./posting", async (importOriginal) => {
  const original = await importOriginal<typeof import("./posting")>();
  return { ...original, postFolioLineWith: async (...args: Parameters<typeof original.postFolioLineWith>) => {
    const result = await original.postFolioLineWith(...args);
    if (control.boundary === "posting" && args[1].kind === "extra") throw new Error("injected after first actual extra");
    return result;
  } };
});
vi.mock("./mutation-helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("./mutation-helpers")>();
  return { ...original, logAudit: async (...args: Parameters<typeof original.logAudit>) => {
    await original.logAudit(...args);
    if (control.boundary === "audit") throw new Error("injected after actual audit");
  } };
});

import { forSystem, forTenant, prisma } from "@revio/db";
import { prisma as sessionPrisma } from "./db";
import { DayAlreadyClosedError, runCloseDay } from "./close-day-run";

describe.skipIf(!enabled)("Close Day against PostgreSQL with real accrual/posting/audit", () => {
  const db = forSystem();
  const tenants: string[] = [];
  let tenantId: string, propertyId: string, absentId: string;
  const date = (s: string) => new Date(`${s}T00:00:00Z`);
  const actor = { kind: "user", userId: "close-day-test-staff" } as const;
  beforeAll(async () => {
    const [role] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date("2026-09-10"));
    control.boundary = null;
    control.afterRead = null;
    control.push.mockReset().mockResolvedValue(undefined);
    const tenant = await db.tenant.create({ data: { name: "Close Day fixture", slug: `close-day-${crypto.randomUUID()}`, isDemo: true } });
    tenantId = tenant.id;
    tenants.push(tenantId);
    const property = await db.property.create({ data: { tenantId, name: "Local fixture", timezone: "UTC", businessDate: date("2026-09-07") } });
    propertyId = property.id;
    const base = { tenantId, propertyId };
    const room = await db.roomType.create({ data: { ...base, name: "Double", code: "DBL", totalRooms: 2, maxGuests: 2 } });
    const plan = await db.ratePlan.create({ data: { ...base, name: "Standard", code: "STD", tags: [] } });
    const unit = await db.unit.create({ data: { ...base, roomTypeId: room.id, label: "101" } });
    const line = { roomTypeId: room.id, ratePlanId: plan.id, checkIn: date("2026-09-07"), checkOut: date("2026-09-11"), priceMinor: 40000 };
    const stay = await db.reservation.create({ data: { ...base, guestName: "Fixture in-house", totalMinor: 40000, lines: { create: line } }, include: { lines: true } });
    const absent = await db.reservation.create({ data: { ...base, guestName: "Fixture absent", totalMinor: 40000, lines: { create: line } } });
    absentId = absent.id;
    await db.roomAssignment.create({ data: { ...base, reservationId: stay.id, reservationLineId: stay.lines[0]!.id, unitId: unit.id, checkIn: line.checkIn, checkOut: line.checkOut, checkedInAt: line.checkIn } });
    await db.stayExtra.createMany({ data: [
      { ...base, reservationId: stay.id, name: "Breakfast", priceMinor: 1200, basis: "per_night" },
      { ...base, reservationId: stay.id, name: "Transfer", priceMinor: 3000, basis: "per_stay" },
    ] });
    // No folio: the close must also seed room charges atomically through the existing service.
  });
  afterEach(() => { vi.useRealTimers(); control.afterRead = null; });
  afterAll(async () => {
    try {
      for (const id of tenants) {
        // ReservationLine restricts room/plan deletion; remove our stays before the tenant cascade.
        await db.reservation.deleteMany({ where: { tenantId: id } });
        await db.tenant.delete({ where: { id } });
      }
    } finally { await prisma.$disconnect(); }
  });

  async function snapshot() {
    return {
      property: await db.property.findUniqueOrThrow({ where: { id: propertyId } }),
      absent: await db.reservation.findUniqueOrThrow({ where: { id: absentId } }),
      folios: await db.folio.count({ where: { propertyId } }),
      lines: await db.folioLine.findMany({ where: { propertyId } }),
      audits: await db.auditEntry.findMany({ where: { propertyId, entity: "close_day" } }),
    };
  }

  it.each(["posting", "accrual", "audit"] as const)("rolls back after %s, then retries without losing or duplicating any charge", async (boundary) => {
    control.boundary = boundary;
    await expect(runCloseDay(tenantId, propertyId, actor, "2026-09-07")).rejects.toThrow("injected");
    const failed = await snapshot();
    expect(failed.property.businessDate).toEqual(date("2026-09-07"));
    expect(failed.property.lastClosedAt).toBeNull();
    expect(failed.absent.status).toBe("confirmed");
    expect(failed.folios).toBe(0);
    expect(failed.lines).toHaveLength(0);
    expect(failed.audits).toHaveLength(0);
    expect(control.push).not.toHaveBeenCalled();
    control.boundary = null;
    await expect(runCloseDay(tenantId, propertyId, actor, "2026-09-07")).resolves.toMatchObject({ accrued: 2, noShows: 1 });
    await expect(runCloseDay(tenantId, propertyId, actor, "2026-09-07")).rejects.toBeInstanceOf(DayAlreadyClosedError);
    const closed = await snapshot();
    expect(closed.lines.map((l) => l.amountMinor).sort((a, b) => a - b)).toEqual([1200, 3000, 40000]);
    expect(closed.audits).toHaveLength(1);
    expect(control.push).toHaveBeenCalledTimes(1);
    // The cron/client passed to recordSync must propagate through to real-channel delivery.
    expect(control.push.mock.calls[0]![0] === sessionPrisma).toBe(false);
    await expect(runCloseDay(tenantId, propertyId, actor, "2026-09-08")).resolves.toMatchObject({ accrued: 1 });
    expect((await snapshot()).lines).toHaveLength(4); // per-stay transfer was not posted twice
  });

  it("lets only one of two DB connections close the same date", async () => {
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    control.afterRead = async () => { if (++reads === 2) release(); await gate; };
    const results = await Promise.allSettled([
      runCloseDay(tenantId, propertyId, actor, "2026-09-07"),
      runCloseDay(tenantId, propertyId, { kind: "system" }, "2026-09-07"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected");
    expect(refused?.status === "rejected" && refused.reason).toBeInstanceOf(DayAlreadyClosedError);
    const closed = await snapshot();
    expect(closed.property.businessDate).toEqual(date("2026-09-08"));
    expect(closed.lines).toHaveLength(3);
    expect(closed.audits).toHaveLength(1);
  });

  it("cannot see or close a property through another tenant perimeter", async () => {
    expect(await forTenant("unrelated-tenant").property.findUnique({ where: { id: propertyId } })).toBeNull();
    expect(await runCloseDay("unrelated-tenant", propertyId, actor, "2026-09-07")).toBeNull();
    expect((await snapshot()).property.businessDate).toEqual(date("2026-09-07"));
  });
});
