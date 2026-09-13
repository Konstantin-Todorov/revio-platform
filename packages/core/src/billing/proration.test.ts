import { describe, it, expect } from "vitest";
import {
  daysInPeriod, firstBillableDay, proratedMinor, prorationFor, prorationNote,
} from "./proration.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("daysInPeriod", () => {
  it("knows the awkward months", () => {
    expect(daysInPeriod("2026-09")).toBe(30);
    expect(daysInPeriod("2026-02")).toBe(28);
    expect(daysInPeriod("2028-02")).toBe(29); // leap year
    expect(daysInPeriod("2026-12")).toBe(31);
  });

  it("refuses a period that is not YYYY-MM", () => {
    expect(() => daysInPeriod("2026-13")).toThrow(/billing period/);
    expect(() => daysInPeriod("September")).toThrow();
  });
});

describe("firstBillableDay — the rule that stops a free day being billed", () => {
  it("is the trial's end when a booking synced DURING the trial", () => {
    /*
     * ⚠️ The whole reason this function exists. `markBillable` does not ask about trials, so a real
     * booking syncing on 8 September stamps billingStartsAt in the middle of a trial that runs to
     * the 20th. Taking billingStartsAt alone would bill 8–20 September, which we promised was free.
     */
    expect(firstBillableDay(d("2026-09-08"), d("2026-09-20"))).toEqual(d("2026-09-20"));
  });

  it("is the live date for an assisted client who never had a trial", () => {
    expect(firstBillableDay(d("2026-09-15"), null)).toEqual(d("2026-09-15"));
  });

  it("is the live date when the trial ended before the platform did anything", () => {
    expect(firstBillableDay(d("2026-09-15"), d("2026-08-02"))).toEqual(d("2026-09-15"));
  });

  it("is null while they are not billable at all", () => {
    expect(firstBillableDay(null, d("2026-09-20"))).toBeNull();
  });
});

describe("prorationFor", () => {
  it("⚠️ a trial converted on the 29th is billed for two days, not thirty", () => {
    // The defect this replaces: the whole month, 28 days of which were free.
    const p = prorationFor("2026-09", d("2026-09-29"));
    expect(p).toEqual({ billedDays: 2, totalDays: 30, from: "2026-09-29" });
  });

  it("counts the joining day itself", () => {
    // The last day of the month is ONE billable day. An exclusive count would charge nothing for
    // the day they actually started paying.
    expect(prorationFor("2026-09", d("2026-09-30"))?.billedDays).toBe(1);
  });

  it("is a full month once they joined in an earlier month", () => {
    expect(prorationFor("2026-10", d("2026-09-20"))).toBeNull();
  });

  it("is a full month when they joined on the 1st", () => {
    expect(prorationFor("2026-09", d("2026-09-01"))?.billedDays).toBe(30);
    expect(proratedMinor(10_000, prorationFor("2026-09", d("2026-09-01")))).toBe(10_000);
  });

  it("⚠️ bills nothing for a month that ends before they joined", () => {
    // Not a full month. A period entirely before the start date must never be charged, and
    // `isBillablePeriod` already refuses it — this is the second lock on the same door.
    const p = prorationFor("2026-08", d("2026-09-20"));
    expect(p?.billedDays).toBe(0);
    expect(proratedMinor(10_000, p)).toBe(0);
  });

  it("has no opinion when there is no start date", () => {
    expect(prorationFor("2026-09", null)).toBeNull();
  });
});

describe("proratedMinor", () => {
  it("charges the fraction, to the cent", () => {
    // €100.00 for 11 of 30 days = €36.67.
    expect(proratedMinor(10_000, prorationFor("2026-09", d("2026-09-20")))).toBe(3_667);
  });

  it("⚠️ can never exceed the full month, whatever the dates say", () => {
    // A clamp rather than a hope: a bad date must not scale the price UP.
    expect(proratedMinor(10_000, { billedDays: 45, totalDays: 30, from: "2026-09-01" })).toBe(10_000);
  });

  it("never returns a negative amount", () => {
    expect(proratedMinor(10_000, { billedDays: -3, totalDays: 30, from: "2026-09-01" })).toBe(0);
  });

  it("leaves a full month exactly alone — no rounding drift", () => {
    for (const amount of [9_999, 10_000, 14_100, 1]) {
      expect(proratedMinor(amount, null)).toBe(amount);
      expect(proratedMinor(amount, prorationFor("2026-09", d("2026-09-01")))).toBe(amount);
    }
  });

  it("⚠️ a prorated month is never MORE than the full month it came from", () => {
    // Exhaustive over every joining day of a 31-day month, at an awkward price.
    const full = 14_137;
    for (let day = 1; day <= 31; day++) {
      const iso = `2026-12-${String(day).padStart(2, "0")}`;
      const amount = proratedMinor(full, prorationFor("2026-12", d(iso)));
      expect(amount).toBeLessThanOrEqual(full);
      expect(amount).toBeGreaterThan(0);
    }
  });

  it("⚠️ joining later never costs more than joining earlier", () => {
    const full = 14_137;
    let previous = Infinity;
    for (let day = 1; day <= 30; day++) {
      const iso = `2026-09-${String(day).padStart(2, "0")}`;
      const amount = proratedMinor(full, prorationFor("2026-09", d(iso)));
      expect(amount).toBeLessThanOrEqual(previous);
      previous = amount;
    }
  });
});

describe("prorationNote — the invoice has to SAY it", () => {
  it("names the day and the days, so nobody has to work it out", () => {
    expect(prorationNote(prorationFor("2026-09", d("2026-09-20"))))
      .toBe("from 2026-09-20 — 11 of 30 days");
  });

  it("says nothing on an ordinary full month", () => {
    expect(prorationNote(null)).toBeNull();
    expect(prorationNote(prorationFor("2026-09", d("2026-09-01")))).toBeNull();
  });
});

// --- the real thing: an actual invoice amount, with the real price list --------------------------

import { monthlyPriceMinor, entitlementsFor } from "./plan-pricing.js";

describe("a real first invoice", () => {
  /** Exactly what `generateInvoices` computes, with the real pricing functions. */
  const invoiceMinor = (
    plan: string,
    products: Parameters<typeof entitlementsFor>[0],
    period: string,
    billingStartsAt: Date | null,
    convertedTrialEnd: Date | null,
  ) =>
    proratedMinor(
      monthlyPriceMinor(plan, entitlementsFor(products)),
      prorationFor(period, firstBillableDay(billingStartsAt, convertedTrialEnd)),
    );

  const GROWTH_ALL = monthlyPriceMinor("growth", entitlementsFor(["channelManager", "reservation", "pms"]));

  it("⚠️ the case this was built for: a trial converted on the 29th", () => {
    /*
     * The hotel signed up on 1 September, a real booking synced on the 8th (stamping
     * billingStartsAt mid-trial), and they decided to keep it on the 29th.
     *
     * Before: the full month — 28 days of which we had called free, on the very first invoice we
     * ever sent them. Now: the two days they actually paid for.
     */
    const list = monthlyPriceMinor("growth", entitlementsFor(["channelManager"]));
    const fair = invoiceMinor("growth", ["channelManager"], "2026-09", d("2026-09-08"), d("2026-09-29"));
    expect(fair).toBe(Math.round((list * 2) / 30));
    expect(fair).toBeLessThan(list);

    // And the old behaviour, stated so the difference is on the record: the whole month, 28 days of
    // which we had called free.
    expect(list - fair).toBeGreaterThan(list * 0.9);
  });

  it("the month AFTER joining is a full month, at the list price", () => {
    expect(invoiceMinor("growth", ["channelManager", "reservation", "pms"], "2026-10", d("2026-09-08"), d("2026-09-29")))
      .toBe(GROWTH_ALL);
  });

  it("an assisted client who went live on the 15th pays for half of September", () => {
    // No trial at all — the same rule, and the same unfairness it removes.
    const month = invoiceMinor("scale", ["channelManager"], "2026-09", d("2026-09-15"), null);
    const full = monthlyPriceMinor("scale", entitlementsFor(["channelManager"]));
    expect(month).toBe(Math.round((full * 16) / 30));
    expect(month).toBeLessThan(full);
  });

  it("⚠️ a trial that EXPIRED is not a converted trial, and cannot move anyone's joining day", () => {
    // Only converted trials reach `firstBillableDay` in the generator. An expired one took the
    // entitlement with it; letting its end date push a PAID product's joining day forward would
    // hand back days the hotel had already bought.
    expect(invoiceMinor("growth", ["reservation"], "2026-10", d("2026-09-01"), null))
      .toBe(monthlyPriceMinor("growth", entitlementsFor(["reservation"])));
  });

  it("never bills a starter client with no products", () => {
    expect(invoiceMinor("starter", [], "2026-09", d("2026-09-10"), null)).toBe(0);
  });
});
