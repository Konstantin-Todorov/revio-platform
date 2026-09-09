import { describe, it, expect } from "vitest";
import {
  vatThresholdStatus, thresholdAdvice, VAT_THRESHOLD_MINOR, type ThresholdInvoice,
} from "./vat-threshold";

/**
 * The rule under test: чл. 96 registration becomes mandatory above EUR 51,130 of **domestic**
 * turnover in a **calendar year**, and the application is due within seven days.
 *
 * Both italicised words are where this goes wrong quietly, so both have their own tests.
 */

const YEAR = 2026;
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

function inv(over: Partial<ThresholdInvoice> = {}): ThresholdInvoice {
  return {
    issuedAt: d("2026-03-01"),
    netMinor: 100_00,
    amountMinor: 100_00,
    buyerCountry: "BG",
    isDemo: false,
    ...over,
  };
}

describe("vatThresholdStatus — what counts", () => {
  it("counts issued domestic invoices", () => {
    const s = vatThresholdStatus([inv(), inv()], "BG", YEAR);
    expect(s.turnoverMinor).toBe(200_00);
    expect(s.countedCount).toBe(2);
  });

  /*
   * The expensive exclusion. An EU B2B sale is supplied where the CUSTOMER is (чл. 21, ал. 2), so it
   * is not Bulgarian turnover. Counting it would have us registering early — and full registration
   * means charging 20% to Bulgarian customers who were not being charged it, plus monthly filings,
   * and it cannot be undone for a year.
   */
  it("EXCLUDES a customer in another country", () => {
    const s = vatThresholdStatus([inv(), inv({ buyerCountry: "DE" })], "BG", YEAR);
    expect(s.turnoverMinor).toBe(100_00);
    expect(s.excludedCount).toBe(1);
  });

  it("excludes demo tenants, like everywhere else money is counted", () => {
    // Their invoices exist so the billing flow stays testable. Including them would report a tax
    // obligation arising from our own rehearsals.
    const s = vatThresholdStatus([inv(), inv({ isDemo: true })], "BG", YEAR);
    expect(s.turnoverMinor).toBe(100_00);
  });

  it("excludes drafts — turnover arises when an invoice is issued, not when it is generated", () => {
    const s = vatThresholdStatus([inv(), inv({ issuedAt: null })], "BG", YEAR);
    expect(s.turnoverMinor).toBe(100_00);
  });

  /*
   * A CALENDAR-year test, not a rolling twelve months. The count restarts on 1 January, which is why
   * an intuition built on "the last year of trading" is wrong in both directions.
   */
  it("counts only the calendar year asked for, boundaries included", () => {
    const rows = [
      inv({ issuedAt: d("2025-12-31") }),
      inv({ issuedAt: d("2026-01-01") }),
      inv({ issuedAt: d("2026-12-31") }),
      inv({ issuedAt: d("2027-01-01") }),
    ];
    expect(vatThresholdStatus(rows, "BG", YEAR).turnoverMinor).toBe(200_00);
  });

  it("uses the net figure, falling back to the draft amount for older invoices", () => {
    const s = vatThresholdStatus([inv({ netMinor: 80_00, amountMinor: 100_00 }), inv({ netMinor: null, amountMinor: 50_00 })], "BG", YEAR);
    expect(s.turnoverMinor).toBe(130_00);
  });

  /*
   * Neither assumed domestic nor silently dropped. Treating an unknown country as domestic would
   * invent a liability; dropping it without saying so would hide one. It is excluded AND reported.
   */
  it("reports invoices with no country rather than guessing either way", () => {
    const s = vatThresholdStatus([inv(), inv({ buyerCountry: null })], "BG", YEAR);
    expect(s.turnoverMinor).toBe(100_00);
    expect(s.unknownCountryCount).toBe(1);
  });

  it("compares countries case- and space-insensitively", () => {
    expect(vatThresholdStatus([inv({ buyerCountry: " bg " })], "BG", YEAR).countedCount).toBe(1);
  });
});

describe("vatThresholdStatus — the bands", () => {
  const at = (minor: number) => vatThresholdStatus([inv({ netMinor: minor, amountMinor: minor })], "BG", YEAR);

  it("is quiet well below, and escalates on the way up", () => {
    expect(at(1_000_00).band).toBe("quiet");
    expect(at(Math.round(VAT_THRESHOLD_MINOR * 0.75)).band).toBe("approaching");
    expect(at(Math.round(VAT_THRESHOLD_MINOR * 0.95)).band).toBe("close");
    expect(at(VAT_THRESHOLD_MINOR + 1).band).toBe("crossed");
  });

  it("says crossed only when actually over, not at exactly the threshold", () => {
    // The law says "exceeds". Registering a company on the strength of an off-by-one is a real cost.
    expect(at(VAT_THRESHOLD_MINOR).crossed).toBe(false);
    expect(at(VAT_THRESHOLD_MINOR + 1).crossed).toBe(true);
  });

  it("never reports negative headroom", () => {
    expect(at(VAT_THRESHOLD_MINOR * 2).remainingMinor).toBe(0);
  });

  it("does not clamp the percentage — being at 200% is information", () => {
    expect(at(VAT_THRESHOLD_MINOR * 2).pctUsed).toBeCloseTo(200, 5);
  });
});

describe("thresholdAdvice", () => {
  const at = (minor: number) => vatThresholdStatus([inv({ netMinor: minor, amountMinor: minor })], "BG", YEAR);

  it("says nothing to a company that is already fully registered", () => {
    // The threshold is behind them. A warning about it would be noise on every screen, forever.
    expect(thresholdAdvice(at(VAT_THRESHOLD_MINOR * 3), "full")).toBeNull();
  });

  it("stays quiet at low turnover rather than nagging", () => {
    expect(thresholdAdvice(at(1_000_00), "art97a")).toBeNull();
  });

  it("names the seven-day deadline once it matters, and not before", () => {
    expect(thresholdAdvice(at(Math.round(VAT_THRESHOLD_MINOR * 0.75)), "art97a")).not.toMatch(/7 days/);
    expect(thresholdAdvice(at(Math.round(VAT_THRESHOLD_MINOR * 0.95)), "art97a")).toMatch(/7 days/);
    expect(thresholdAdvice(at(VAT_THRESHOLD_MINOR + 1), "none")).toMatch(/7 days/);
  });

  it("tells a crossed company that registration is now mandatory", () => {
    expect(thresholdAdvice(at(VAT_THRESHOLD_MINOR + 1), "art97a")).toMatch(/mandatory/);
  });
});
