import { describe, it, expect } from "vitest";
import { availabilityPressure, remainingShare, LOW_AVAILABILITY_SHARE } from "./availability-pressure.js";

/**
 * The rule replaced here was `remaining <= 2`, a global integer. The tests below are mostly the
 * cases that rule got wrong, because those are the reason it changed.
 */
describe("availabilityPressure", () => {
  it("stops calling a small type urgent when most of it is free", () => {
    // 2 of 3 suites is 67% still open. The old rule flagged this amber and taught the user to
    // ignore amber.
    expect(availabilityPressure(2, 3)).toBe("open");
  });

  it("starts calling a large type urgent when it nearly is", () => {
    // 3 of 40 is under 8% — effectively sold out, and the old rule said nothing at all.
    expect(availabilityPressure(3, 40)).toBe("low");
  });

  it("treats one remaining as tight whatever the arithmetic says", () => {
    // 1 of 3 is 33%, above the share threshold — but one room left is one room left.
    expect(availabilityPressure(1, 3)).toBe("low");
    expect(availabilityPressure(1, 100)).toBe("low");
  });

  it("marks sold out and overbooked distinctly — they need different actions", () => {
    expect(availabilityPressure(0, 10)).toBe("soldout");
    expect(availabilityPressure(-1, 10)).toBe("overbooked");
  });

  it("is urgent about an overbooking on any size of type", () => {
    for (const capacity of [1, 3, 40, 400]) {
      expect(availabilityPressure(-1, capacity)).toBe("overbooked");
    }
  });

  it("sits exactly on the threshold as low, not open", () => {
    // 8 of 40 is exactly 20%. A boundary that flips the wrong way is the classic off-by-one in a
    // threshold rule.
    expect(LOW_AVAILABILITY_SHARE).toBe(0.2);
    expect(availabilityPressure(8, 40)).toBe("low");
    expect(availabilityPressure(9, 40)).toBe("open");
  });

  it("does not divide by zero on a type with no rooms", () => {
    expect(availabilityPressure(0, 0)).toBe("soldout");
    expect(availabilityPressure(2, 0)).toBe("open");
    expect(Number.isNaN(remainingShare(2, 0))).toBe(false);
  });

  it("scales the same way across wildly different capacities", () => {
    // The whole point: the same PROPORTION reads the same at any size.
    for (const capacity of [10, 50, 200]) {
      expect(availabilityPressure(Math.round(capacity * 0.1), capacity)).toBe("low");
      expect(availabilityPressure(Math.round(capacity * 0.5), capacity)).toBe("open");
    }
  });
});

describe("remainingShare", () => {
  it("is a 0..1 fraction, clamped", () => {
    expect(remainingShare(5, 10)).toBe(0.5);
    expect(remainingShare(-3, 10)).toBe(0);
    expect(remainingShare(15, 10)).toBe(1);
  });
});
