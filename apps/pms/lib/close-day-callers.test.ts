import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const io = vi.hoisted(() => ({ run: vi.fn(), flash: vi.fn(), session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: {} }));
vi.mock("./session", () => ({ getSession: io.session }));
vi.mock("@revio/ui/flash", () => ({ setFlash: io.flash }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./mutation-helpers", () => ({ logAudit: vi.fn(), str: (fd: FormData, name: string) => String(fd.get(name) ?? "").trim() }));
vi.mock("./close-day-run", () => ({
  runCloseDay: io.run,
  DayAlreadyClosedError: class extends Error {},
  InvalidCloseDayError: class extends Error {},
}));
import { closeDay } from "./actions-closeday";
import { autoCloseOverdueDays } from "./auto-close";
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
