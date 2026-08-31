import { describe, it, expect } from "vitest";
import {
  monthlyTouristTax, annualTouristTaxFloor, daysInYear, estimateBeds, nightsInMonth,
  monthlyTaxDueDate, annualDeclarationDueDate, annualTopUpDueDate,
  STATUTORY_RATE_MIN_MINOR, STATUTORY_RATE_MAX_MINOR, ANNUAL_OCCUPANCY_FLOOR,
} from "./tourist-tax.js";

describe("monthlyTouristTax — чл. 61с ал. 2", () => {
  it("is nights times the rate", () => {
    expect(monthlyTouristTax(120, 100)).toBe(12000);
  });
  it("is zero for a month with no nights, and for a rate not yet set", () => {
    expect(monthlyTouristTax(0, 100)).toBe(0);
    expect(monthlyTouristTax(120, 0)).toBe(0);
  });
  it("never goes negative on nonsense input", () => {
    expect(monthlyTouristTax(-5, 100)).toBe(0);
  });
  it("holds the statutory band the council chooses within", () => {
    expect(STATUTORY_RATE_MIN_MINOR).toBe(20);
    expect(STATUTORY_RATE_MAX_MINOR).toBe(300);
  });
});

describe("daysInYear", () => {
  it("counts a leap year as 366 — it moves the 30% floor", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2026)).toBe(365);
  });
  it("gets the century rule right", () => {
    expect(daysInYear(1900)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
  });
});

describe("annualTouristTaxFloor — чл. 61с ал. 4–5", () => {
  it("computes ДД = (Р × Л × Д × 30%) − ДП", () => {
    // 365 days × 10 beds × 1.00 × 30% = 1095.00; already paid 400.00 → 695.00 owed.
    const r = annualTouristTaxFloor({ year: 2026, beds: 10, rateMinor: 100, paidMinor: 40000 });
    expect(r.floorMinor).toBe(109500);
    expect(r.topUpMinor).toBe(69500);
    expect(r.clearsFloor).toBe(false);
  });

  it("owes nothing when the year's real nights already clear the floor", () => {
    const r = annualTouristTaxFloor({ year: 2026, beds: 10, rateMinor: 100, paidMinor: 200000 });
    expect(r.topUpMinor).toBe(0);
    expect(r.clearsFloor).toBe(true);
  });

  it("does not refund a year that overshoots — the statute pays nothing back", () => {
    const r = annualTouristTaxFloor({ year: 2026, beds: 4, rateMinor: 100, paidMinor: 999999 });
    expect(r.topUpMinor).toBe(0);
  });

  it("is assessed on the YEAR, not the month — a quiet February is not topped up", () => {
    // The whole point of the provision. Run monthly it would bill every closed month of a seasonal
    // property, which is most of the Bulgarian coast.
    const year = annualTouristTaxFloor({ year: 2026, beds: 10, rateMinor: 100, paidMinor: 109500 });
    expect(year.topUpMinor).toBe(0);
  });

  it("uses 366 days in a leap year", () => {
    expect(annualTouristTaxFloor({ year: 2024, beds: 10, rateMinor: 100, paidMinor: 0 }).floorMinor)
      .toBe(Math.round(366 * 10 * 100 * 0.3));
  });

  it("is inert until the property has stated a rate and a bed count", () => {
    expect(annualTouristTaxFloor({ year: 2026, beds: 0, rateMinor: 100, paidMinor: 0 }).topUpMinor).toBe(0);
    expect(annualTouristTaxFloor({ year: 2026, beds: 10, rateMinor: 0, paidMinor: 0 }).topUpMinor).toBe(0);
  });

  it("pins the floor at 30%", () => {
    expect(ANNUAL_OCCUPANCY_FLOOR).toBe(0.3);
  });
});

describe("the three statutory dates", () => {
  it("puts the month's tax on the 15th of the following month — чл. 61с ал. 3", () => {
    expect(monthlyTaxDueDate("2026-08")).toBe("2026-09-15");
  });
  it("rolls December into January of the next year", () => {
    expect(monthlyTaxDueDate("2026-12")).toBe("2027-01-15");
  });
  it("puts the declaration on 31 January — чл. 61р ал. 5", () => {
    expect(annualDeclarationDueDate(2026)).toBe("2027-01-31");
  });
  it("puts the annual top-up on 1 March — чл. 61с ал. 4", () => {
    expect(annualTopUpDueDate(2026)).toBe("2027-03-01");
  });
});

describe("estimateBeds", () => {
  it("multiplies sleeping capacity by the number of rooms", () => {
    expect(estimateBeds([{ maxGuests: 2, totalRooms: 10 }, { maxGuests: 4, totalRooms: 5 }])).toBe(40);
  });
  it("is zero for a property with nothing set up", () => {
    expect(estimateBeds([])).toBe(0);
  });
  it("ignores negative nonsense rather than subtracting beds", () => {
    expect(estimateBeds([{ maxGuests: -2, totalRooms: 10 }])).toBe(0);
  });
});

describe("nightsInMonth — чл. 61с ал. 2 taxes nights PROVIDED in the month", () => {
  it("counts a stay wholly inside the month", () => {
    expect(nightsInMonth("2026-08-10", "2026-08-14", "2026-08")).toBe(4);
  });

  it("splits a stay across the month boundary", () => {
    // 30 & 31 August are August's nights; 1 September is September's. Billed whole to either month
    // the annual total is right and both returns are wrong.
    expect(nightsInMonth("2026-08-30", "2026-09-02", "2026-08")).toBe(2);
    expect(nightsInMonth("2026-08-30", "2026-09-02", "2026-09")).toBe(1);
  });

  it("gives nothing to a month the stay never touched", () => {
    // The bug the backfill exposed: a stay registered in August for nights slept in June.
    expect(nightsInMonth("2026-06-23", "2026-06-27", "2026-08")).toBe(0);
    expect(nightsInMonth("2026-06-23", "2026-06-27", "2026-06")).toBe(4);
  });

  it("counts only the covered part of a stay that spans a whole month", () => {
    expect(nightsInMonth("2026-07-20", "2026-09-05", "2026-08")).toBe(31);
  });

  it("is zero while the guest is still in house — no departure, no nights provided", () => {
    expect(nightsInMonth("2026-08-10", null, "2026-08")).toBe(0);
  });

  it("handles February in a leap year", () => {
    expect(nightsInMonth("2024-02-01", "2024-03-01", "2024-02")).toBe(29);
  });

  it("is zero for a same-day stay and for a reversed one", () => {
    expect(nightsInMonth("2026-08-10", "2026-08-10", "2026-08")).toBe(0);
    expect(nightsInMonth("2026-08-14", "2026-08-10", "2026-08")).toBe(0);
  });

  it("sums back to the stay's own night count across the months it touches", () => {
    // The property of the split that actually matters: nothing is created or lost by it.
    const a = nightsInMonth("2026-08-30", "2026-09-02", "2026-08");
    const b = nightsInMonth("2026-08-30", "2026-09-02", "2026-09");
    expect(a + b).toBe(3);
  });
});
