import { describe, expect, it } from "vitest";
import {
  decimalOr,
  intOr,
  minorUnitsOr,
  numberFieldError,
  parseNumberField,
} from "./parse";

describe("parseNumberField", () => {
  /*
   * The three cases that were all silently becoming 0. These are the regression tests for Y1 —
   * if any of them ever returns { kind: "value", value: 0 } again, a hotel is one keystroke away
   * from closing its property out on every channel.
   */
  it("distinguishes absent from empty from invalid, and none of them is zero", () => {
    expect(parseNumberField(null)).toEqual({ kind: "absent" });
    expect(parseNumberField(undefined)).toEqual({ kind: "absent" });
    expect(parseNumberField("")).toEqual({ kind: "empty" });
    expect(parseNumberField("   ")).toEqual({ kind: "empty" });
    expect(parseNumberField("abc")).toEqual({ kind: "invalid", raw: "abc" });
  });

  it("still reads a real zero as a real zero", () => {
    // The whole point is that "" and 0 stop being the same thing — 0 must survive.
    expect(parseNumberField("0")).toEqual({ kind: "value", value: 0 });
    expect(parseNumberField("0.0")).toEqual({ kind: "value", value: 0 });
  });

  it("reads ordinary numbers", () => {
    expect(parseNumberField("12")).toEqual({ kind: "value", value: 12 });
    expect(parseNumberField(" 12 ")).toEqual({ kind: "value", value: 12 });
    expect(parseNumberField("129.50")).toEqual({ kind: "value", value: 129.5 });
    expect(parseNumberField("-3")).toEqual({ kind: "value", value: -3 });
    expect(parseNumberField(".5")).toEqual({ kind: "value", value: 0.5 });
  });

  /*
   * `Number()` accepts all of these. A hotelier means none of them, and each one is a plausible
   * typo or paste that would otherwise become a real, wrong value.
   */
  it.each(["0x10", "1e3", "Infinity", "-Infinity", "NaN", "1,5", "12 34", "£12", "12%"])(
    "rejects %p rather than coercing it",
    (raw) => {
      expect(parseNumberField(raw).kind).toBe("invalid");
    },
  );

  it("enforces integer, min and max as rejections rather than clamping", () => {
    expect(parseNumberField("1.5", { integer: true }).kind).toBe("invalid");
    expect(parseNumberField("2", { integer: true })).toEqual({ kind: "value", value: 2 });
    expect(parseNumberField("-1", { min: 0 }).kind).toBe("invalid");
    expect(parseNumberField("101", { max: 100 }).kind).toBe("invalid");
    expect(parseNumberField("100", { max: 100 })).toEqual({ kind: "value", value: 100 });
  });
});

describe("intOr", () => {
  /*
   * The behaviour the old `int()` claimed to have. Every one of these returned 0 before, ignoring
   * the fallback that 21 call sites were passing in the belief it protected them.
   */
  it("returns the fallback for absent, empty and invalid", () => {
    expect(intOr(null, 365)).toBe(365);
    expect(intOr(undefined, 365)).toBe(365);
    expect(intOr("", 365)).toBe(365);
    expect(intOr("   ", 365)).toBe(365);
    expect(intOr("abc", 365)).toBe(365);
  });

  it("returns the value when there is one, including zero", () => {
    expect(intOr("0", 365)).toBe(0);
    expect(intOr("42", 365)).toBe(42);
  });

  it("truncates a decimal rather than rejecting it", () => {
    // A number input with step=1 can still be given 2.7 by a paste. Truncating matches what the old
    // helper did for real numbers, so no existing call site changes meaning.
    expect(intOr("2.7", 0)).toBe(2);
    expect(intOr("-2.7", 0)).toBe(-2);
  });

  /** The exact scenario from the bug report, on the field where it costs the most. */
  it("does not close a hotel out when someone types letters into rooms-to-sell", () => {
    const roomsToSell = intOr("", 12);
    expect(roomsToSell).toBe(12);
    expect(roomsToSell).not.toBe(0);
  });
});

describe("decimalOr", () => {
  it("keeps the fraction", () => {
    expect(decimalOr("129.50", 0)).toBe(129.5);
    expect(decimalOr("", 99)).toBe(99);
    expect(decimalOr("abc", 99)).toBe(99);
  });
});

describe("minorUnitsOr", () => {
  it("converts major units to minor units", () => {
    expect(minorUnitsOr("129.50", 0)).toBe(12950);
    expect(minorUnitsOr("0", 0)).toBe(0);
    expect(minorUnitsOr("", 5000)).toBe(5000);
  });

  /*
   * Math.trunc(1.15 * 100) is 114 in binary floating point. A cent that disappears between the
   * quote and the invoice is exactly the kind of thing an all-in-pricing promise cannot survive.
   */
  it.each([
    ["1.15", 115],
    ["8.85", 885],
    ["1.005", 101],
    ["129.99", 12999],
  ])("rounds %s to %i minor units instead of truncating", (raw, expected) => {
    expect(minorUnitsOr(raw, 0)).toBe(expected);
  });

  it("rejects a negative price", () => {
    expect(minorUnitsOr("-5", 0)).toBe(0);
  });
});

describe("numberFieldError", () => {
  it("says nothing when the field was fine, absent or simply blank", () => {
    expect(numberFieldError("Rooms", { kind: "value", value: 1 })).toBeNull();
    expect(numberFieldError("Rooms", { kind: "absent" })).toBeNull();
    expect(numberFieldError("Rooms", { kind: "empty" })).toBeNull();
  });

  it("names the field and the constraint", () => {
    const invalid = { kind: "invalid", raw: "x" } as const;
    expect(numberFieldError("Rooms to sell", invalid)).toBe("Rooms to sell must be a number.");
    expect(numberFieldError("VAT", invalid, { min: 0, max: 100 })).toBe(
      "VAT must be a number between 0 and 100.",
    );
    expect(numberFieldError("Nights", invalid, { integer: true })).toBe(
      "Nights must be a whole number.",
    );
  });
});
