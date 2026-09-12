import { describe, expect, it, vi, afterEach } from "vitest";
import { dayMonth, isWeekend, money, relativeTime, weekday, ymd } from "./format";

/**
 * The formatters every RevioCRS screen renders through.
 *
 * Small functions, but they are on the calendar, the reservation list, the folio and every report —
 * so a mistake here is not one wrong screen, it is one wrong number everywhere at once, in the shape
 * people trust most: a rendered value.
 *
 * Two things are load-bearing and neither is obvious from the code: money is **integer minor units**
 * (the platform's rule — never floats), and every date function reads **UTC**, because an inventory
 * date is a calendar date and must not shift when the server or the reader is in another timezone.
 */

afterEach(() => vi.useRealTimers());

describe("money", () => {
  it("takes minor units, never a decimal amount", () => {
    // ⚠️ The single easiest mistake in this codebase: passing 195 meaning €195.
    expect(money(19_500)).toBe("€195");
    expect(money(195)).toBe("€1.95");
  });

  it("drops the decimals on a whole amount and keeps them otherwise", () => {
    // A calendar of "€350.00" across 30 columns is noise; "€350.50" must not become "€350".
    expect(money(35_000)).toBe("€350");
    expect(money(35_050)).toBe("€350.50");
    expect(money(35_099)).toBe("€350.99");
  });

  it("groups thousands, so a five-figure total is readable at a glance", () => {
    expect(money(1_234_567)).toBe("€12,345.67");
  });

  it("renders zero as a real price, not as nothing", () => {
    // Zero means free. It is not the same as unpriced, which renders "—" elsewhere.
    expect(money(0)).toBe("€0");
  });

  it("keeps a historical лева row in лева", () => {
    // Bulgaria is on the euro, but an invoice issued before that must still read as it was issued.
    expect(money(10_000, "BGN")).toBe("лв100");
  });

  it("falls back to the code rather than inventing a symbol", () => {
    expect(money(10_000, "CHF")).toBe("CHF 100");
  });

  it("never renders a negative as though it were positive", () => {
    // Refunds and corrections exist; hiding the sign would be a wrong number, not a tidy one.
    expect(money(-5_000)).toBe("€-50");
  });
});

describe("the date helpers read UTC, not the reader's clock", () => {
  /*
   * ⚠️ THE one that matters. An inventory date is a calendar date at the property, stored at UTC
   * midnight. If these used local getters, a server or a browser west of UTC would render 2026-09-12
   * as the 11th — every calendar column off by one, silently, and only for some people.
   */
  it("keeps a UTC-midnight date on its own day", () => {
    const d = new Date("2026-09-12T00:00:00Z");
    expect(ymd(d)).toBe("2026-09-12");
    expect(weekday(d)).toBe("Sat");
    expect(dayMonth(d)).toBe("12 Sep");
  });

  it("does not roll over late in the UTC day", () => {
    const d = new Date("2026-09-12T23:59:59Z");
    expect(ymd(d)).toBe("2026-09-12");
    expect(weekday(d)).toBe("Sat");
  });

  it("marks Saturday and Sunday as the weekend, and nothing else", () => {
    // The calendar tints these. A hotel reads weekend occupancy differently from a Tuesday's.
    const days = ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"];
    expect(days.map((d) => isWeekend(new Date(`${d}T00:00:00Z`)))).toEqual([
      true,  // Sat
      true,  // Sun
      false, false, false, false, false,
    ]);
  });

  it("names every weekday and month correctly across a year", () => {
    // Off-by-one in a lookup table is invisible until somebody notices "Jan" on a February row.
    expect(weekday(new Date("2026-01-01T00:00:00Z"))).toBe("Thu");
    expect(dayMonth(new Date("2026-01-01T00:00:00Z"))).toBe("1 Jan");
    expect(dayMonth(new Date("2026-12-31T00:00:00Z"))).toBe("31 Dec");
    expect(dayMonth(new Date("2026-02-28T00:00:00Z"))).toBe("28 Feb");
  });
});

describe("relativeTime", () => {
  it("says '—' rather than inventing a time it was not given", () => {
    // "never synced" and "synced at the epoch" mean opposite things.
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(undefined)).toBe("—");
    expect(relativeTime("")).toBe("—");
  });

  it("steps through seconds, minutes, hours and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
    expect(relativeTime(new Date("2026-09-12T11:59:30Z"))).toBe("30s ago");
    expect(relativeTime(new Date("2026-09-12T11:45:00Z"))).toBe("15 min ago");
    expect(relativeTime(new Date("2026-09-12T09:00:00Z"))).toBe("3h ago");
    expect(relativeTime(new Date("2026-09-10T12:00:00Z"))).toBe("2d ago");
  });

  it("accepts the string form a serialised row arrives as", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
    expect(relativeTime("2026-09-12T11:00:00Z")).toBe("1h ago");
  });
});
