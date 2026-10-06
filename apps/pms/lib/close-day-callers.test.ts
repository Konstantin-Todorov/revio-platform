import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const io = vi.hoisted(() => ({ run: vi.fn(), flash: vi.fn(), session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: {} }));
vi.mock("./session", () => ({ getSession: io.session }));
vi.mock("@revio/ui/flash", () => ({ setFlash: io.flash }));
// The toast is said through the dictionary now; English is what these assertions read.
vi.mock("./i18n/server", () => ({ i18n: async () => ({ locale: "en", t: <T,>(d: { en: T }) => d.en }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./mutation-helpers", () => ({ logAudit: vi.fn(), str: (fd: FormData, name: string) => String(fd.get(name) ?? "").trim() }));
vi.mock("./close-day-run", () => ({
  runCloseDay: io.run,
  DayAlreadyClosedError: class extends Error {},
  InvalidCloseDayError: class extends Error {},
}));
import { closeDay } from "./actions-closeday";
import { autoCloseOverdueDays, CLOSE_CONCURRENCY } from "./auto-close";
import { DayAlreadyClosedError } from "./close-day-run";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
  io.session.mockResolvedValue({ tenantId: "tenant", activePropertyId: "hotel", userId: "staff", role: "owner" });
  io.run.mockResolvedValue({ businessDate: "2026-09-07", next: "2026-09-08", noShows: 0, accrued: 0, carriedForward: [] });
});
afterEach(() => vi.useRealTimers());
function form(property = "hotel") {
  const fd = new FormData();
  fd.set("propertyId", property);
  fd.set("businessDate", "2026-09-07");
  return fd;
}

describe("Close Day caller intent", () => {
  it("renders both intent fields in the actual Close Day form", () => {
    const source = readFileSync(new URL("../app/(protected)/closeday/page.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/<form action=\{closeDay\}>\s*<input type="hidden" name="businessDate" value=\{businessDate\} \/>\s*<input type="hidden" name="propertyId" value=\{property.id\} \/>/);
  });
  it("passes the displayed date but always takes tenant/property authority from the session", async () => {
    await expect(closeDay(form())).rejects.toThrow("redirect:/closeday?closed=0");
    expect(io.run).toHaveBeenCalledWith("tenant", "hotel", { kind: "user", userId: "staff" }, "2026-09-07");
  });
  it("refuses a stale tab after a property switch", async () => {
    await expect(closeDay(form("previous-hotel"))).rejects.toThrow("redirect:/closeday");
    expect(io.run).not.toHaveBeenCalled();
    expect(io.flash).toHaveBeenCalledWith("info", expect.stringContaining("active property changed"));
  });
  it("retains the manage capability gate", async () => {
    io.session.mockResolvedValue({ role: "housekeeper" });
    await expect(closeDay(form())).rejects.toThrow("redirect:");
    expect(io.run).not.toHaveBeenCalled();
  });
  it("explains stale intent without attributing every close to the automatic job", async () => {
    io.run.mockRejectedValueOnce(new DayAlreadyClosedError("2026-09-07"));
    await expect(closeDay(form())).rejects.toThrow("redirect:/closeday");
    expect(io.flash).toHaveBeenCalledWith("info", expect.stringContaining("No additional day was closed"));
  });
  it.each(["stale", "disabled", "success"])("uses the sweep's date and handles %s without closing forward", async (result) => {
    if (result === "stale") io.run.mockRejectedValueOnce(new DayAlreadyClosedError("2026-09-07"));
    if (result === "disabled") io.run.mockResolvedValueOnce(null);
    const db = {
      property: { findMany: vi.fn(async () => [{ id: "hotel", tenantId: "tenant", name: "Hotel", timezone: "UTC", businessDate: new Date("2026-09-07T00:00:00Z") }]) },
      propertyDefaults: { findMany: vi.fn(async () => []) },
    };
    const outcome = await autoCloseOverdueDays(db as unknown as Parameters<typeof autoCloseOverdueDays>[0]);
    expect(io.run).toHaveBeenCalledTimes(1);
    expect(io.run).toHaveBeenCalledWith("tenant", "hotel", { kind: "system" }, "2026-09-07");
    expect(outcome.closed).toBe(result === "success" ? 1 : 0);
    expect(outcome.skipped).toBe(result === "success" ? 0 : 1);
  });
});

describe("the automatic sweep at scale", () => {
  const props = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, tenantId: `t${i}`, name: `Hotel ${i}`, timezone: "UTC", businessDate: new Date("2026-09-07T00:00:00Z") }));
  const dbOf = (n: number) => ({
    property: { findMany: vi.fn(async () => props(n)) },
    propertyDefaults: { findMany: vi.fn(async () => []) },
  }) as unknown as Parameters<typeof autoCloseOverdueDays>[0];

  it("⚠️ one hotel that fails does not leave the others' day open", async () => {
    io.run.mockImplementation(async (_t: string, id: string) => {
      if (id === "h1") throw new Error("lock timeout");
      return { businessDate: "2026-09-07", next: "2026-09-08", noShows: 0, accrued: 0, carriedForward: [] };
    });
    const out = await autoCloseOverdueDays(dbOf(6));
    expect(io.run).toHaveBeenCalledTimes(6);
    expect(out.closed).toBe(5);
    expect(out.failed).toBe(1);
    expect(out.details.some((d) => d.startsWith("Hotel 1: FAILED"))).toBe(true);
  });

  it("closes several at once, but never more than the pool allows, and each exactly once", async () => {
    let inFlight = 0, peak = 0;
    io.run.mockImplementation(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setImmediate(r));
      inFlight--;
      return { businessDate: "2026-09-07", next: "2026-09-08", noShows: 0, accrued: 0, carriedForward: [] };
    });
    const out = await autoCloseOverdueDays(dbOf(10));
    expect(out.closed).toBe(10);
    expect(new Set(io.run.mock.calls.map((c) => c[1])).size).toBe(10);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(CLOSE_CONCURRENCY);
  });
});
