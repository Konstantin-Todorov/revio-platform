import { describe, expect, it } from "vitest";
import { engagementOf, type EngagementFacts } from "./engagement";

/**
 * Every threshold in this file is a judgement somebody will argue with once there are real
 * customers, which is exactly the kind of rule that rots quietly when it is spread across JSX.
 *
 * The tests are written as the phone calls they should produce.
 */

const healthy = (o: Partial<EngagementFacts> = {}): EngagementFacts => ({
  activeDays: 22,
  windowDays: 30,
  peopleActive: 4,
  staffAccounts: 6,
  screensUsed: 14,
  screensAvailable: 20,
  viewsLast7d: 300,
  viewsPrev7d: 280,
  lastSeenDaysAgo: 0,
  tenureDays: 200,
  unownedProducts: [],
  ...o,
});

describe("the verdict", () => {
  it("says thriving when they are in most days with more than one person", () => {
    expect(engagementOf(healthy()).verdict).toBe("thriving");
  });

  it("says steady for an ordinary working rhythm", () => {
    // The majority of healthy customers live here, and it must not read as a problem.
    const e = engagementOf(healthy({ activeDays: 8, peopleActive: 2 }));
    expect(e.verdict).toBe("steady");
    expect(e.detail).toMatch(/normal rhythm/i);
  });

  /*
   * THE one a totals-based screen always misses. A hotel halfway down from a strong month still has
   * a healthy-looking 30-day total; the only thing that catches it is comparing the two weeks, and
   * it is the only verdict here with a deadline attached.
   */
  it("catches a hotel whose use has halved, even though it is in today", () => {
    const e = engagementOf(healthy({ viewsPrev7d: 400, viewsLast7d: 150, lastSeenDaysAgo: 0 }));
    expect(e.verdict).toBe("slipping");
    // −62, not −63: Math.round(−62.5) rounds toward +∞ in JS. Pinned so the sign of a halving is
    // never quietly read as a rise by a later refactor reaching for Math.round on a negative.
    expect(e.trendPct).toBe(-62);
  });

  it("says quiet after a fortnight of silence", () => {
    const e = engagementOf(healthy({ lastSeenDaysAgo: 21 }));
    expect(e.verdict).toBe("quiet");
    expect(e.detail).toMatch(/what leaving looks like/i);
  });

  it("says never opened when nobody has ever been in", () => {
    // Paying for something nobody has logged into: the most expensive failure in SaaS and the most
    // fixable, but only in the first month.
    const e = engagementOf(healthy({ lastSeenDaysAgo: null, activeDays: 0, peopleActive: 0 }));
    expect(e.verdict).toBe("never_started");
    expect(e.detail).toMatch(/One phone call fixes this/);
  });

  it("says nothing at all about a hotel in its first fortnight", () => {
    // A flag raised during setup is noise, and noise teaches people to ignore the column.
    for (const facts of [{ lastSeenDaysAgo: null }, { lastSeenDaysAgo: 10 }, { activeDays: 0 }]) {
      const e = engagementOf(healthy({ tenureDays: 5, ...facts }));
      expect(e.verdict).toBe("too_new");
    }
  });
});

describe("the three measures, because one score would decide nothing", () => {
  /*
   * The measure most people never take, and the best churn predictor here. Two hotels with identical
   * view counts are completely different businesses if one of them is a single manager — and the
   * note has to change at exactly one person, not at some percentage of staff.
   */
  it("calls out a product that only one person uses, whatever the view count", () => {
    const e = engagementOf(healthy({ peopleActive: 1, staffAccounts: 12, viewsLast7d: 900 }));
    expect(e.reach.note).toMatch(/one person only — it leaves if they do/i);
  });

  it("separates using it from looking at it", () => {
    const shallow = engagementOf(healthy({ screensUsed: 2 }));
    expect(shallow.depth.note).toMatch(/a corner of what they bought/);
    expect(engagementOf(healthy()).depth.note).toMatch(/running the hotel on it/);
  });

  it("reports every measure against its own denominator, so it can be checked", () => {
    const e = engagementOf(healthy());
    expect(e.regularity).toMatchObject({ value: 22, outOf: 30 });
    expect(e.reach).toMatchObject({ value: 4, outOf: 6 });
    expect(e.depth).toMatchObject({ value: 14, outOf: 20 });
  });

  it("reports no trend at all when last week had nothing to compare to", () => {
    // Going from nothing to something is not "+100%" and not "no change" — there is no percentage,
    // and inventing one reads a first week of use as explosive growth.
    expect(engagementOf(healthy({ viewsPrev7d: 0, viewsLast7d: 120 })).trendPct).toBeNull();
  });
});

describe("is it time for an upsell", () => {
  const ready = (o: Partial<EngagementFacts> = {}) =>
    engagementOf(healthy({ unownedProducts: ["RevioPMS"], ...o }));

  it("opens the call with their evidence, not with our quota", () => {
    const reasons = ready().upsellReasons;
    expect(reasons.length).toBeGreaterThan(2);
    expect(reasons[0]).toMatch(/In on 22 of the last 30 days/);
    expect(reasons.join(" ")).toMatch(/4 of their people/);
    expect(reasons.join(" ")).toMatch(/do not yet have RevioPMS/);
  });

  it("says nothing when there is nothing left to sell them", () => {
    expect(engagementOf(healthy({ unownedProducts: [] })).upsellReasons).toEqual([]);
  });

  /*
   * Selling a second product to somebody who has not opened the first is how you manufacture a
   * refund — and a weak pitch costs more than the one you skipped.
   */
  it("refuses to pitch a hotel that is not using what it already bought", () => {
    for (const facts of [
      { lastSeenDaysAgo: 30 },
      { lastSeenDaysAgo: null },
      { viewsPrev7d: 400, viewsLast7d: 100 },
      { activeDays: 3 },
    ]) {
      expect(ready(facts).upsellReasons, JSON.stringify(facts)).toEqual([]);
    }
  });

  it("waits until they have had long enough to form an opinion", () => {
    expect(ready({ tenureDays: 40 }).upsellReasons).toEqual([]);
    expect(ready({ tenureDays: 70 }).upsellReasons.length).toBeGreaterThan(0);
  });
});
