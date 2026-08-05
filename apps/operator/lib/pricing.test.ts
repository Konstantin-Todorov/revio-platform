import { describe, expect, it } from "vitest";
import {
  BUNDLE_DISCOUNT_PCT,
  COMBINATIONS,
  MODULE_MINOR,
  PLAN_BASE_MINOR,
  ROOM_TIERS,
  attributeRevenue,
  combinationKeyOf,
  directBookingFeeMinor,
  entitlementsFor,
  monthlyPriceMinor,
  priceBreakdown,
  splitProportionally,
} from "./pricing.js";

const ALL = entitlementsFor(["channelManager", "reservation", "pms"]);
const CM = entitlementsFor(["channelManager"]);
const NONE = entitlementsFor([]);

describe("priceBreakdown", () => {
  it("adds the platform fee to the module fees", () => {
    const b = priceBreakdown("growth", CM);
    expect(b.platformMinor).toBe(5_000);
    expect(b.moduleSubtotalMinor).toBe(4_900);
    expect(b.totalMinor).toBe(9_900);
  });

  it("gives no discount on a single module", () => {
    expect(priceBreakdown("starter", CM).discountMinor).toBe(0);
  });

  it("discounts the modules, never the platform fee", () => {
    // The platform fee is cost-to-serve. It does not get cheaper because they bought more software.
    const b = priceBreakdown("scale", ALL);
    expect(b.platformMinor).toBe(15_000);
    expect(b.moduleSubtotalMinor).toBe(4_900 + 5_900 + 6_900);
    expect(b.discountPct).toBe(20);
    expect(b.discountMinor).toBe(Math.round(17_700 * 0.2));
    expect(b.totalMinor).toBe(15_000 + 17_700 - 3_540);
  });

  it("prices the full platform below any single module, per product, on EVERY tier", () => {
    // The pricing page states this as a fact in its footer — "the full platform costs less per
    // product than any single module bought alone" — so it has to be true at every tier, not just
    // the one someone checked by hand. At starter the margin is thin (€47.20 against €49), which is
    // exactly why it is pinned.
    for (const plan of Object.keys(PLAN_BASE_MINOR)) {
      const perProductBundled = monthlyPriceMinor(plan, ALL) / 3;
      const cheapestAlone = Math.min(
        ...COMBINATIONS.filter((c) => c.products.length === 1)
          .map((c) => monthlyPriceMinor(plan, entitlementsFor(c.products))),
      );
      expect(perProductBundled, `${plan}`).toBeLessThan(cheapestAlone);
    }
  });

  it("charges only the platform fee when nothing is bought", () => {
    expect(monthlyPriceMinor("growth", NONE)).toBe(5_000);
    expect(monthlyPriceMinor("starter", NONE)).toBe(0);
  });
});

describe("the price list as a whole", () => {
  it("NEVER lets a client pay less by buying more", () => {
    // The failure a percentage discount invites: tune the 3-module discount up far enough and the
    // full platform slips below the price of the most expensive pair, so a customer saves money by
    // adding a product. Checked exhaustively so editing a constant fails here rather than in an
    // invoice. Every superset of a combination must cost at least as much as it does.
    for (const plan of Object.keys(PLAN_BASE_MINOR)) {
      for (const a of COMBINATIONS) {
        for (const b of COMBINATIONS) {
          const isSuperset = a.products.every((p) => b.products.includes(p));
          if (!isSuperset || a.key === b.key) continue;
          expect(
            monthlyPriceMinor(plan, entitlementsFor(b.products)),
            `${plan}: ${b.label} must not cost less than ${a.label}`,
          ).toBeGreaterThanOrEqual(monthlyPriceMinor(plan, entitlementsFor(a.products)));
        }
      }
    }
  });

  it("rises with the room tier for every combination", () => {
    for (const c of COMBINATIONS) {
      const ent = entitlementsFor(c.products);
      const prices = ROOM_TIERS.map((t) => monthlyPriceMinor(t.plan, ent));
      for (let i = 1; i < prices.length; i++) expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
    }
  });

  it("covers all seven ways to buy it, with no duplicates", () => {
    expect(COMBINATIONS).toHaveLength(7);
    expect(new Set(COMBINATIONS.map((c) => c.key)).size).toBe(7);
    for (const c of COMBINATIONS) {
      expect(combinationKeyOf(entitlementsFor(c.products))).toBe(c.key);
    }
  });

  it("has a discount schedule that only ever grows", () => {
    expect(BUNDLE_DISCOUNT_PCT[1]).toBeLessThanOrEqual(BUNDLE_DISCOUNT_PCT[2]!);
    expect(BUNDLE_DISCOUNT_PCT[2]).toBeLessThanOrEqual(BUNDLE_DISCOUNT_PCT[3]!);
  });
});

describe("splitProportionally", () => {
  it("splits in proportion to the weights", () => {
    expect(splitProportionally(1_000, [1, 1])).toEqual([500, 500]);
    expect(splitProportionally(900, [1, 2])).toEqual([300, 600]);
  });

  it("sums to EXACTLY the total when the split does not divide evenly", () => {
    // Rounding each share independently loses or invents cents, and a revenue-by-product chart whose
    // parts disagree with MRR by 1c makes every other number on the page suspect.
    for (const total of [1, 7, 99, 100, 4_901, 17_699, 1_000_001]) {
      for (const weights of [[1, 1, 1], [4_900, 5_900, 6_900], [1, 2, 97], [3, 3]]) {
        expect(splitProportionally(total, weights).reduce((s, v) => s + v, 0)).toBe(total);
      }
    }
  });

  it("gives the leftover cent to the largest fractional share, not to the first", () => {
    // 100 split 1:1:1 is 33.33 each; the extra cent goes somewhere deterministic.
    const s = splitProportionally(100, [1, 1, 1]);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
    expect(s.filter((v) => v === 34)).toHaveLength(1);
  });

  it("returns zeros rather than dividing by zero when there is nothing to weight", () => {
    expect(splitProportionally(500, [])).toEqual([]);
    expect(splitProportionally(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("attributeRevenue", () => {
  it("splits a client's price across the products they actually have", () => {
    const a = attributeRevenue("starter", CM);
    expect(a.byProduct.channelManager).toBe(4_900);
    expect(a.byProduct.reservation).toBe(0);
    expect(a.byProduct.pms).toBe(0);
  });

  it("always sums to exactly what the client pays", () => {
    // The invariant that makes "revenue by product" trustworthy: no matter the discount or the
    // platform fee, the parts add up to MRR.
    for (const plan of Object.keys(PLAN_BASE_MINOR)) {
      for (const c of COMBINATIONS) {
        const ent = entitlementsFor(c.products);
        const a = attributeRevenue(plan, ent);
        const summed = Object.values(a.byProduct).reduce((s, v) => s + v, 0) + a.unallocatedMinor;
        expect(summed, `${plan} / ${c.label}`).toBe(monthlyPriceMinor(plan, ent));
      }
    }
  });

  it("reports a platform fee from a client with no products as unallocated, not as a product's", () => {
    // Real revenue that belongs to no product. Silently folding it into one would overstate that
    // product every time someone is between purchases.
    const a = attributeRevenue("scale", NONE);
    expect(a.unallocatedMinor).toBe(15_000);
    expect(Object.values(a.byProduct).every((v) => v === 0)).toBe(true);
  });

  it("gives the more expensive module the larger share", () => {
    const a = attributeRevenue("starter", ALL);
    expect(a.byProduct.pms).toBeGreaterThan(a.byProduct.reservation);
    expect(a.byProduct.reservation).toBeGreaterThan(a.byProduct.channelManager);
  });
});

describe("directBookingFeeMinor", () => {
  it("takes 2% of what the booking engine produced", () => {
    expect(directBookingFeeMinor(100_000)).toBe(2_000);
  });

  it("is nothing when the engine produced nothing", () => {
    expect(directBookingFeeMinor(0)).toBe(0);
  });

  it("stays far below what an OTA would have taken on the same booking", () => {
    // The entire argument for the fee. If this ever failed, the pitch would be dishonest.
    const revenue = 250_000;
    expect(directBookingFeeMinor(revenue)).toBeLessThan((revenue * 15) / 100);
  });
});
