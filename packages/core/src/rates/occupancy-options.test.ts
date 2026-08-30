import { describe, it, expect } from "vitest";
import {
  validateOptions, describeProblem, optionPrice, priceAllOccupancies,
  expandToPerPerson, collapseToPerRoom, defaultOptions, effectiveModel, effectivePrimary,
  MAX_OCCUPANCY, type OccupancyOption,
} from "./occupancy-options.js";

const opt = (o: Partial<OccupancyOption> & { occupancy: number }): OccupancyOption => ({
  isPrimary: false, mode: "manual", rateMinor: 10000, ...o,
});

describe("per-room is the one-row special case", () => {
  it("a per-room plan is one row at the ceiling, primary", () => {
    const o = defaultOptions("per_room", 4, 12000);
    expect(o).toEqual([{ occupancy: 4, isPrimary: true, mode: "manual", rateMinor: 12000 }]);
    expect(validateOptions(o, "per_room", 4)).toEqual([]);
  });

  it("rejects a per-room plan carrying more than one row", () => {
    const o = [opt({ occupancy: 4, isPrimary: true }), opt({ occupancy: 2 })];
    expect(validateOptions(o, "per_room", 4).map((p) => p.kind)).toContain("per-room-extra-rows");
  });

  it("rejects a per-room row that is not at the ceiling", () => {
    // A per-room price covers the whole room, so it belongs at the room's maximum.
    const o = [opt({ occupancy: 2, isPrimary: true })];
    expect(validateOptions(o, "per_room", 4).map((p) => p.kind)).toContain("per-room-wrong-occupancy");
  });
});

describe("per-person must be contiguous", () => {
  it("accepts 1…max with one primary", () => {
    expect(validateOptions(defaultOptions("per_person", 3, 9000), "per_person", 3)).toEqual([]);
  });

  it("rejects a gap — the failure that survives a Channex 200", () => {
    // A missing occupancy is not "unavailable at that party size"; it is a plan that cannot quote an
    // ordinary booking, and Channex accepts it without complaint.
    const o = [opt({ occupancy: 1 }), opt({ occupancy: 3, isPrimary: true })];
    const problems = validateOptions(o, "per_person", 3);
    expect(problems.find((p) => p.kind === "gap")).toMatchObject({ missing: [2] });
  });

  it("names every missing count, not just the first", () => {
    const o = [opt({ occupancy: 4, isPrimary: true })];
    expect(validateOptions(o, "per_person", 4).find((p) => p.kind === "gap")).toMatchObject({ missing: [1, 2, 3] });
  });
});

describe("exactly one primary", () => {
  it("rejects none", () => {
    const o = [opt({ occupancy: 1 }), opt({ occupancy: 2 })];
    expect(validateOptions(o, "per_person", 2).map((p) => p.kind)).toContain("no-primary");
  });
  it("rejects two", () => {
    const o = [opt({ occupancy: 1, isPrimary: true }), opt({ occupancy: 2, isPrimary: true })];
    expect(validateOptions(o, "per_person", 2).map((p) => p.kind)).toContain("many-primaries");
  });
  it("rejects a primary that derives from itself", () => {
    const o = [opt({ occupancy: 1 }), opt({ occupancy: 2, isPrimary: true, mode: "derived", adjustmentType: "percent", direction: "decrease", value: 10 })];
    expect(validateOptions(o, "per_person", 2).map((p) => p.kind)).toContain("primary-derived");
  });
});

describe("other validation", () => {
  it("rejects an occupancy above what the room sleeps", () => {
    const o = [opt({ occupancy: 1 }), opt({ occupancy: 2, isPrimary: true }), opt({ occupancy: 5 })];
    expect(validateOptions(o, "per_person", 2).map((p) => p.kind)).toContain("above-ceiling");
  });
  it("caps the ceiling at MAX_OCCUPANCY however large the room claims to be", () => {
    expect(defaultOptions("per_person", 40, 100)).toHaveLength(MAX_OCCUPANCY);
  });
  it("rejects a derived row with no rule — it has no price at all", () => {
    const o = [opt({ occupancy: 1, mode: "derived", rateMinor: null }), opt({ occupancy: 2, isPrimary: true })];
    expect(validateOptions(o, "per_person", 2).map((p) => p.kind)).toContain("derived-without-rule");
  });
  it("every problem has a sentence a hotelier can act on", () => {
    const o = [opt({ occupancy: 3 }), opt({ occupancy: 3 })];
    for (const p of validateOptions(o, "per_person", 3)) {
      expect(describeProblem(p).length).toBeGreaterThan(20);
    }
  });
});

describe("optionPrice", () => {
  const options = [
    opt({ occupancy: 1, mode: "derived", rateMinor: null, adjustmentType: "fixed", direction: "decrease", value: 2000 }),
    opt({ occupancy: 2, isPrimary: true, rateMinor: 12000 }),
    opt({ occupancy: 3, mode: "manual", rateMinor: 14000 }),
  ];

  it("returns the primary's price for the primary", () => {
    expect(optionPrice(options, 2, 12000)).toBe(12000);
  });
  it("computes a derived row FROM THE PRIMARY, not from the row below", () => {
    // Chaining compounds rounding and makes one edit shift every row beneath it.
    expect(optionPrice(options, 1, 12000)).toBe(10000);
  });
  it("returns a manual row's own price", () => {
    expect(optionPrice(options, 3, 12000)).toBe(14000);
  });
  it("follows the primary when the primary changes", () => {
    expect(optionPrice(options, 1, 15000)).toBe(13000);
  });
  it("never goes below zero — a 200% discount is a typo, not a negative rate", () => {
    const silly = [opt({ occupancy: 1, mode: "derived", rateMinor: null, adjustmentType: "percent", direction: "decrease", value: 200 }), opt({ occupancy: 2, isPrimary: true })];
    expect(optionPrice(silly, 1, 10000)).toBe(0);
  });
  it("returns null for an occupancy the plan does not price", () => {
    expect(optionPrice(options, 4, 12000)).toBeNull();
  });

  it("prices every occupancy in order for a calendar row or a Channex payload", () => {
    expect(priceAllOccupancies(options, 12000)).toEqual([
      { occupancy: 1, minor: 10000, isPrimary: false },
      { occupancy: 2, minor: 12000, isPrimary: true },
      { occupancy: 3, minor: 14000, isPrimary: false },
    ]);
  });
});

describe("switching model loses no rate data", () => {
  it("expanding carries the existing price onto the primary", () => {
    const before = defaultOptions("per_room", 3, 11000);
    const after = expandToPerPerson(before, 3, 2, "copy");
    expect(after).toHaveLength(3);
    expect(after.find((o) => o.isPrimary)).toMatchObject({ occupancy: 2, rateMinor: 11000 });
    expect(validateOptions(after, "per_person", 3)).toEqual([]);
  });

  it("`copy` seeds every occupancy at what the hotel charged yesterday", () => {
    const after = expandToPerPerson(defaultOptions("per_room", 3, 11000), 3, 2, "copy");
    expect(after.every((o) => o.rateMinor === 11000)).toBe(true);
  });

  it("`derive` seeds the non-primary rows with a rule instead of a price", () => {
    const after = expandToPerPerson(defaultOptions("per_room", 3, 11000), 3, 2, "derive", {
      adjustmentType: "fixed", direction: "decrease", value: 1500,
    });
    const one = after.find((o) => o.occupancy === 1)!;
    expect(one.mode).toBe("derived");
    expect(optionPrice(after, 1, 11000)).toBe(9500);
  });

  it("collapsing keeps the primary's price as the room price", () => {
    const perPerson = [opt({ occupancy: 1, rateMinor: 8000 }), opt({ occupancy: 2, isPrimary: true, rateMinor: 12000 })];
    expect(collapseToPerRoom(perPerson, 2, 12000)).toEqual([
      { occupancy: 2, isPrimary: true, mode: "manual", rateMinor: 12000 },
    ]);
  });

  it("round-trips: per-room → per-person → per-room keeps the original price", () => {
    const start = defaultOptions("per_room", 4, 13500);
    const expanded = expandToPerPerson(start, 4, 4, "copy");
    const back = collapseToPerRoom(expanded, 4, 13500);
    expect(back).toEqual(start);
  });

  it("expanding keeps rows the hotel had already customised", () => {
    const partial = [opt({ occupancy: 1, rateMinor: 7000 }), opt({ occupancy: 2, isPrimary: true, rateMinor: 12000 })];
    const after = expandToPerPerson(partial, 3, 2, "copy");
    expect(after.find((o) => o.occupancy === 1)?.rateMinor).toBe(7000);
  });
});

describe("inheritance", () => {
  it("a plan with no model inherits the property's", () => {
    expect(effectiveModel(null, "per_person")).toBe("per_person");
    expect(effectiveModel(undefined, "per_room")).toBe("per_room");
  });
  it("a plan may override the property — Channex sets sell_mode per plan", () => {
    expect(effectiveModel("per_room", "per_person")).toBe("per_room");
  });
  it("an unrecognised value falls back to per_room rather than guessing", () => {
    expect(effectiveModel("nonsense", "per_person")).toBe("per_room");
  });

  it("primary falls back plan → room default → ceiling", () => {
    expect(effectivePrimary(1, 2, 4)).toBe(1);
    expect(effectivePrimary(null, 2, 4)).toBe(2);
    expect(effectivePrimary(null, null, 4)).toBe(4);
  });
  it("clamps a primary above the ceiling instead of producing an unreachable one", () => {
    expect(effectivePrimary(9, null, 4)).toBe(4);
    expect(effectivePrimary(0, null, 4)).toBe(1);
  });
});
