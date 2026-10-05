import { describe, expect, it } from "vitest";
import { directDiscountPercent, discountedNight, normalisePromo, promoPercentFor, promoRefusal, type PromoRule } from "./promo";

const base: PromoRule = { code: "SUMMER10", percentOff: 10, stayFrom: "2026-06-01", stayTo: "2026-09-30", minNights: 2, ratePlanIds: [], maxUses: 100, usedCount: 3, active: true };

describe("promo codes", () => {
  it("normalises what a guest types", () => {
    expect(normalisePromo("  summer 10! ")).toBe("SUMMER10");
  });

  it("applies within its dates and length", () => {
    expect(promoRefusal(base, { arrival: "2026-07-10", nights: 3 })).toBeNull();
  });

  it("says why it does not apply", () => {
    expect(promoRefusal(null, { arrival: "2026-07-10", nights: 3 })).toBe("unknown");
    expect(promoRefusal({ ...base, active: false }, { arrival: "2026-07-10", nights: 3 })).toBe("inactive");
    expect(promoRefusal(base, { arrival: "2026-10-10", nights: 3 })).toBe("dates");
    expect(promoRefusal(base, { arrival: "2026-07-10", nights: 1 })).toBe("nights");
    expect(promoRefusal({ ...base, usedCount: 100 }, { arrival: "2026-07-10", nights: 3 })).toBe("used_up");
  });

  it("is limited to its rates when it names them", () => {
    expect(promoPercentFor({ ...base, ratePlanIds: ["a"] }, "b")).toBe(0);
    expect(promoPercentFor({ ...base, ratePlanIds: ["a"] }, "a")).toBe(10);
  });

  it("takes the percentage off a night, rounded to the cent", () => {
    expect(discountedNight(9999, 10)).toBe(8999);
    expect(discountedNight(10000, 0)).toBe(10000);
  });
});

describe("directDiscountPercent", () => {
  it("keeps 0–30 and refuses the rest", () => {
    expect(directDiscountPercent(5)).toBe(5);
    expect(directDiscountPercent(0)).toBe(0);
    expect(directDiscountPercent(null)).toBe(0);
    expect(directDiscountPercent(-4)).toBe(0);
    expect(directDiscountPercent(50)).toBe(30);
    expect(directDiscountPercent(Number.NaN)).toBe(0);
  });
  it("stacks with a code without rounding drift beyond a cent per night", () => {
    expect(discountedNight(discountedNight(10000, 5), 10)).toBe(8550);
  });
});
