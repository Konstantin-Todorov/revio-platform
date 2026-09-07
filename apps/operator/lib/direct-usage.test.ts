import { describe, it, expect } from "vitest";
import { periodRange } from "./pricing";

describe("periodRange — the month an invoice covers", () => {
  it("is half-open, so month boundaries cannot double-count", () => {
    const { from, to } = periodRange("2026-08");
    expect(from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // A booking at the last instant of August belongs to August, and one at midnight to September.
    expect(new Date("2026-08-31T23:59:59.999Z") < to).toBe(true);
    expect(new Date("2026-09-01T00:00:00.000Z") < to).toBe(false);
  });

  it("rolls the year at December", () => {
    const { from, to } = periodRange("2026-12");
    expect(from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("handles February in a leap year without special-casing it", () => {
    const { to } = periodRange("2028-02");
    expect(to.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("refuses a period that is not YYYY-MM rather than inventing a range", () => {
    // Silently billing the wrong month is worse than failing to bill.
    expect(() => periodRange("2026-13")).toThrow();
    expect(() => periodRange("2026")).toThrow();
    expect(() => periodRange("nonsense")).toThrow();
  });
});
