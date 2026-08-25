import { describe, it, expect } from "vitest";

/**
 * "Free until your first booking syncs."
 *
 * The rule `generateInvoices` applies, isolated so it is testable without a database. Two conditions,
 * and the second is the one that is easy to leave out — a gate that only defers the FIRST invoice
 * then bills the whole back-catalogue the moment a booking lands is the same broken promise with a
 * delay on it.
 */
function isBillable(period: string, billingStartsAt: Date | null): boolean {
  if (!billingStartsAt) return false;
  return period >= billingStartsAt.toISOString().slice(0, 7);
}

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("the free period", () => {
  it("bills nothing before a booking has ever synced", () => {
    expect(isBillable("2026-08", null)).toBe(false);
  });

  it("a hotel that never takes a booking stays free forever", () => {
    // Correct, and not a loophole: no value delivered, no charge.
    for (const period of ["2026-08", "2027-01", "2030-12"]) {
      expect(isBillable(period, null)).toBe(false);
    }
  });

  it("bills the month the first booking synced", () => {
    expect(isBillable("2026-08", at("2026-08-14"))).toBe(true);
  });

  it("bills every month after", () => {
    expect(isBillable("2026-09", at("2026-08-14"))).toBe(true);
    expect(isBillable("2027-03", at("2026-08-14"))).toBe(true);
  });

  it("never bills a month that ended before they became billable", () => {
    // The half-fix this guards against: defer the first invoice, then charge for all the months
    // they were promised free.
    expect(isBillable("2026-07", at("2026-08-14"))).toBe(false);
    expect(isBillable("2026-01", at("2026-08-14"))).toBe(false);
  });

  it("handles the first day and last day of the starting month identically", () => {
    expect(isBillable("2026-08", at("2026-08-01"))).toBe(true);
    expect(isBillable("2026-08", at("2026-08-31"))).toBe(true);
  });

  it("crosses a year boundary correctly", () => {
    // String comparison on YYYY-MM only works because the format is zero-padded and fixed-width.
    expect(isBillable("2027-01", at("2026-12-20"))).toBe(true);
    expect(isBillable("2026-12", at("2027-01-05"))).toBe(false);
  });

  it("sorts month strings the way it counts them", () => {
    // "2026-9" would break the comparison; the format must stay zero-padded.
    const months = ["2026-09", "2026-10", "2026-11", "2027-01"];
    expect([...months].sort()).toEqual(months);
  });
});
