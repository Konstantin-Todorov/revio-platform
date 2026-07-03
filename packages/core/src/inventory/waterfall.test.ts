import { describe, expect, it } from "vitest";
import { computeWaterfall, expandInventoryPeriods } from "./waterfall.js";

describe("availability waterfall", () => {
  it("computes the spec's worked example (50 total, 2 OOO, 1 hold, 35 confirmed → 12 remaining)", () => {
    const w = computeWaterfall({ physical: 50, outOfOrder: 2, closed: 0, holds: 1, confirmed: 35 });
    expect(w.available).toBe(48);
    expect(w.remaining).toBe(12);
  });

  it("defaults every layer to zero", () => {
    const w = computeWaterfall({ physical: 10 });
    expect(w).toMatchObject({ available: 10, remaining: 10, outOfOrder: 0, holds: 0 });
  });

  it("manual rooms-to-sell override replaces the physical base, not the holds/confirmed layers", () => {
    const w = computeWaterfall({ physical: 50, outOfOrder: 5, manualSellLimit: 20, holds: 2, confirmed: 10 });
    expect(w.available).toBe(20);
    expect(w.remaining).toBe(8);
  });

  it("a null override falls through to physical − ooo − closed", () => {
    const w = computeWaterfall({ physical: 30, outOfOrder: 3, closed: 7, manualSellLimit: null });
    expect(w.available).toBe(20);
  });

  it("closures and OOO can never push available below zero", () => {
    expect(computeWaterfall({ physical: 4, outOfOrder: 3, closed: 3 }).available).toBe(0);
  });

  it("remaining goes negative — that IS the overbooking signal", () => {
    expect(computeWaterfall({ physical: 5, confirmed: 6 }).remaining).toBe(-1);
  });
});

describe("expandInventoryPeriods", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];

  it("applies each period only inside its inclusive range", () => {
    const map = expandInventoryPeriods(
      [{ kind: "out_of_order", dateFrom: "2026-07-02", dateTo: "2026-07-03", rooms: 2 }],
      dates,
    );
    expect(map.get("2026-07-01")).toEqual({ outOfOrder: 0, closed: 0 });
    expect(map.get("2026-07-02")).toEqual({ outOfOrder: 2, closed: 0 });
    expect(map.get("2026-07-03")).toEqual({ outOfOrder: 2, closed: 0 });
    expect(map.get("2026-07-04")).toEqual({ outOfOrder: 0, closed: 0 });
  });

  it("stacks overlapping periods and separates OOO from closures", () => {
    const map = expandInventoryPeriods(
      [
        { kind: "out_of_order", dateFrom: "2026-07-01", dateTo: "2026-07-04", rooms: 1 },
        { kind: "out_of_order", dateFrom: "2026-07-02", dateTo: "2026-07-02", rooms: 2 },
        { kind: "closure", dateFrom: "2026-07-02", dateTo: "2026-07-03", rooms: 5 },
      ],
      dates,
    );
    expect(map.get("2026-07-02")).toEqual({ outOfOrder: 3, closed: 5 });
    expect(map.get("2026-07-03")).toEqual({ outOfOrder: 1, closed: 5 });
  });
});
