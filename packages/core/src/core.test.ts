import { describe, expect, it } from "vitest";
import { bookableForChannel, computeAvailability, isOverbooking } from "./inventory/availability.js";
import { applyRounding, deriveRate } from "./rates/derive.js";
import { occupancyPrice } from "./rates/occupancy.js";
import { resolveRestriction } from "./restrictions/resolve.js";

describe("availability", () => {
  it("computes total minus confirmed", () => {
    expect(computeAvailability({ totalInventory: 12, confirmedUnits: 4 })).toBe(8);
  });
  it("manual override becomes the baseline", () => {
    expect(
      computeAvailability({ totalInventory: 12, confirmedUnits: 4, manualOverride: 6 }),
    ).toBe(6);
  });
  it("stop sell sends 0 bookable without changing availability", () => {
    expect(bookableForChannel({ availability: 8, stopSell: true })).toBe(0);
  });
  it("channel allocation caps bookable", () => {
    expect(bookableForChannel({ availability: 8, stopSell: false, channelAllocation: 3 })).toBe(3);
  });
  it("never reports negative", () => {
    expect(bookableForChannel({ availability: -2, stopSell: false })).toBe(0);
  });
  it("flags overbooking when nothing was left", () => {
    expect(isOverbooking(0)).toBe(true);
    expect(isOverbooking(1)).toBe(false);
  });
});

describe("derived rates", () => {
  it("Non-Refundable = Standard − 10%", () => {
    expect(deriveRate(12000, { parentRatePlanId: "std", adjustmentType: "percent", direction: "decrease", value: 10 })).toBe(10800);
  });
  it("Breakfast = Standard + €12", () => {
    expect(deriveRate(12000, { parentRatePlanId: "std", adjustmentType: "fixed", direction: "increase", value: 1200 })).toBe(13200);
  });
  it("respects a price floor", () => {
    expect(deriveRate(10000, { parentRatePlanId: "std", adjustmentType: "percent", direction: "decrease", value: 90, floorMinor: 5000 })).toBe(5000);
  });
  it("rounds to .99", () => {
    expect(applyRounding(12000, "end_99")).toBe(11999);
    expect(applyRounding(12050, "end_99")).toBe(12099);
  });
});

describe("occupancy pricing", () => {
  it("1 guest = base − €10 (price for 2 minus 10)", () => {
    expect(occupancyPrice(12000, { occupancy: 1, adjustmentType: "fixed", direction: "decrease", value: 1000 })).toBe(11000);
  });
  it("no adjustment returns the base price", () => {
    expect(occupancyPrice(12000, undefined)).toBe(12000);
  });
  it("supports a percentage occupancy discount", () => {
    expect(occupancyPrice(10000, { occupancy: 1, adjustmentType: "percent", direction: "decrease", value: 20 })).toBe(8000);
  });
});

describe("booking loop invariants", () => {
  it("a booking decrements availability and a cancellation restores it", () => {
    const before = computeAvailability({ totalInventory: 8, confirmedUnits: 0 });
    const afterBooking = computeAvailability({ totalInventory: 8, confirmedUnits: 2 });
    const afterCancel = computeAvailability({ totalInventory: 8, confirmedUnits: 0 });
    expect(before).toBe(8);
    expect(afterBooking).toBe(6);
    expect(afterCancel).toBe(before);
  });
  it("a booking onto a sold-out date is flagged as overbooking", () => {
    expect(isOverbooking(computeAvailability({ totalInventory: 3, confirmedUnits: 3 }))).toBe(true);
  });
});

describe("restriction priority", () => {
  const sources = {
    manual: 3 as const,
    matchingRules: [{ priority: 1, value: 2 }],
    ratePlanDefault: 1,
  };
  it("manual wins over rule and default", () => {
    expect(resolveRestriction("min_los", sources).source).toBe("manual");
  });
  it("rule wins over default when no manual", () => {
    expect(resolveRestriction("min_los", { matchingRules: [{ priority: 5, value: 2 }], ratePlanDefault: 1 }).value).toBe(2);
  });
  it("falls back to rate plan default", () => {
    expect(resolveRestriction("min_los", { ratePlanDefault: 1 }).source).toBe("rate_plan_default");
  });
});
