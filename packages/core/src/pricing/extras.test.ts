import { describe, expect, it } from "vitest";
import { extraTotalMinor, extrasTotalMinor, resolveChosenExtras, type SellableExtra } from "./extras.js";

const breakfast: SellableExtra = { id: "b", name: "Breakfast", priceMinor: 1200, basis: "per_night" };
const transfer: SellableExtra = { id: "t", name: "Airport transfer", priceMinor: 3000, basis: "per_stay" };

describe("extraTotalMinor", () => {
  it("multiplies a per-night extra by the nights", () => {
    expect(extraTotalMinor(breakfast, 3)).toBe(3600);
  });

  it("charges a per-stay extra once, however long the stay", () => {
    expect(extraTotalMinor(transfer, 1)).toBe(3000);
    expect(extraTotalMinor(transfer, 14)).toBe(3000);
  });

  it("never bills zero nights — a stay is at least one", () => {
    expect(extraTotalMinor(breakfast, 0)).toBe(1200);
    expect(extraTotalMinor(breakfast, -3)).toBe(1200);
  });

  it("does NOT multiply by guests — a quoted €12 breakfast is charged at €12", () => {
    // Per-person pricing would need its own basis and its own line; a silent factor here is exactly
    // the surprise total the all-in promise exists to prevent.
    expect(extraTotalMinor(breakfast, 2)).toBe(2400);
  });
});

describe("extrasTotalMinor", () => {
  it("sums a mixed basket over the stay", () => {
    // 2 nights: breakfast 1200×2 + transfer 3000 once
    expect(extrasTotalMinor([breakfast, transfer], 2)).toBe(5400);
  });

  it("is zero for an empty basket, so the total is untouched", () => {
    expect(extrasTotalMinor([], 5)).toBe(0);
  });
});

describe("resolveChosenExtras", () => {
  it("drops ids the hotel does not offer — the selection is untrusted form input", () => {
    expect(resolveChosenExtras([breakfast, transfer], ["b", "not-on-offer"]).map((e) => e.id)).toEqual(["b"]);
  });

  it("returns catalogue order, so the confirmation lists them as the booking page did", () => {
    expect(resolveChosenExtras([breakfast, transfer], ["t", "b"]).map((e) => e.id)).toEqual(["b", "t"]);
  });
});
