import { describe, it, expect } from "vitest";
import { leadDays, isAdvancePurchaseClosed } from "./advance-purchase.js";

const TODAY = "2026-06-27";

describe("leadDays", () => {
  it("counts whole days forward and backward", () => {
    expect(leadDays(TODAY, "2026-06-27")).toBe(0);
    expect(leadDays(TODAY, "2026-06-30")).toBe(3);
    expect(leadDays(TODAY, "2026-06-26")).toBe(-1);
  });
});

describe("advance-purchase rolling close", () => {
  it("Min 3 closes the next 3 days (lead 0,1,2) and opens day 3 onward", () => {
    const w = { min: 3 };
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-27", w)).toBe(true); // lead 0
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-29", w)).toBe(true); // lead 2
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-30", w)).toBe(false); // lead 3
    expect(isAdvancePurchaseClosed(TODAY, "2026-07-10", w)).toBe(false);
  });

  it("Max 3 closes everything beyond 3 days out (lead 4+) and keeps the window open", () => {
    const w = { max: 3 };
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-30", w)).toBe(false); // lead 3
    expect(isAdvancePurchaseClosed(TODAY, "2026-07-01", w)).toBe(true); // lead 4
  });

  it("supports both bounds together (only the window stays open)", () => {
    const w = { min: 2, max: 5 };
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-28", w)).toBe(true); // lead 1 < min
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-29", w)).toBe(false); // lead 2
    expect(isAdvancePurchaseClosed(TODAY, "2026-07-02", w)).toBe(false); // lead 5
    expect(isAdvancePurchaseClosed(TODAY, "2026-07-03", w)).toBe(true); // lead 6 > max
  });

  it("is a no-op when neither bound is set", () => {
    expect(isAdvancePurchaseClosed(TODAY, "2026-06-27", {})).toBe(false);
    expect(isAdvancePurchaseClosed(TODAY, "2026-07-27", { min: null, max: null })).toBe(false);
  });
});
