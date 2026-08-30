import { describe, it, expect } from "vitest";
import { planPricingModelSwitch, describeSwitch, planCeiling, type PlanToSwitch } from "./pricing-model-switch.js";
import { defaultOptions, validateOptions, optionPrice } from "./occupancy-options.js";

const plan = (o: Partial<PlanToSwitch> = {}): PlanToSwitch => ({
  ratePlanId: "p1",
  planName: "Standard Rate",
  planModel: null,
  primaryOccupancy: null,
  roomTypes: [{ roomTypeId: "r1", maxOccupancy: 3, defaultOccupancy: 2 }],
  options: defaultOptions("per_room", 3, 12000),
  ...o,
});

describe("planCeiling — the smallest cap wins", () => {
  it("takes the smallest, so one option set is valid everywhere the plan sells", () => {
    expect(planCeiling([{ maxOccupancy: 2 }, { maxOccupancy: 4 }])).toBe(2);
  });
  it("never exceeds the platform ceiling", () => {
    expect(planCeiling([{ maxOccupancy: 99 }])).toBe(18);
  });
  it("copes with a plan attached to no room type", () => {
    expect(planCeiling([])).toBe(1);
  });
});

describe("per-room → per-person", () => {
  const out = planPricingModelSwitch({
    target: "per_person", propertyModel: "per_room", plans: [plan()], seed: "copy",
  });

  it("expands to one row per occupancy", () => {
    expect(out.changedCount).toBe(1);
    expect(out.results[0]!.before).toBe(1);
    expect(out.results[0]!.after).toBe(3);
  });

  it("KEEPS THE EXISTING PRICE on the primary — no rate data lost", () => {
    const r = out.results[0]!;
    expect(r.primaryOccupancy).toBe(2);
    expect(r.options.find((o) => o.isPrimary)).toMatchObject({ occupancy: 2, rateMinor: 12000 });
  });

  it("produces a valid option set", () => {
    expect(validateOptions(out.results[0]!.options, "per_person", 3)).toEqual([]);
  });

  it("seeds with a rule when asked, instead of a flat copy", () => {
    const derived = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room", plans: [plan()], seed: "derive",
      seedRule: { adjustmentType: "fixed", direction: "decrease", value: 2000 },
    });
    const opts = derived.results[0]!.options;
    expect(optionPrice(opts, 1, 12000)).toBe(10000);
    expect(optionPrice(opts, 2, 12000)).toBe(12000);
  });
});

describe("per-person → per-room", () => {
  it("collapses to one row carrying the primary's price", () => {
    const perPerson = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room", plans: [plan()], seed: "copy",
    }).results[0]!.options;

    const back = planPricingModelSwitch({
      target: "per_room", propertyModel: "per_person",
      plans: [plan({ options: perPerson })], seed: "copy",
    });
    expect(back.results[0]!.options).toEqual([
      { occupancy: 3, isPrimary: true, mode: "manual", rateMinor: 12000 },
    ]);
  });

  it("round-trips without losing the price", () => {
    const start = defaultOptions("per_room", 3, 9900);
    const there = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [plan({ options: start, primaryOccupancy: 3 })], seed: "copy",
    }).results[0]!.options;
    const back = planPricingModelSwitch({
      target: "per_room", propertyModel: "per_person",
      plans: [plan({ options: there, primaryOccupancy: 3 })], seed: "copy",
    }).results[0]!.options;
    expect(back).toEqual(start);
  });
});

describe("a plan that overrode the model is left alone", () => {
  it("a property toggle does not revert a deliberate per-plan choice", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [plan({ planModel: "per_room" })], seed: "copy",
    });
    expect(out.results[0]!.changed).toBe(false);
    expect(out.results[0]!.skipped).toMatch(/on its own/i);
    // And its rows are untouched.
    expect(out.results[0]!.options).toHaveLength(1);
  });

  it("but a plan overriding TO the target is still processed", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [plan({ planModel: "per_person" })], seed: "copy",
    });
    expect(out.results[0]!.changed).toBe(true);
  });
});

describe("no-op detection", () => {
  it("reports a no-op rather than an empty diff", () => {
    const already = planPricingModelSwitch({
      target: "per_room", propertyModel: "per_room", plans: [plan()], seed: "copy",
    });
    expect(already.noop).toBe(true);
    expect(describeSwitch(already, "per_room")).toMatch(/nothing to change/i);
  });

  it("is idempotent — switching twice changes nothing the second time", () => {
    const once = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room", plans: [plan()], seed: "copy",
    }).results[0]!.options;
    const twice = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_person",
      plans: [plan({ options: once, primaryOccupancy: 2 })], seed: "copy",
    });
    expect(twice.noop).toBe(true);
  });
});

describe("the whole property at once", () => {
  it("plans the lot and counts what moves", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [
        plan({ ratePlanId: "a", planName: "Standard" }),
        plan({ ratePlanId: "b", planName: "Breakfast" }),
        plan({ ratePlanId: "c", planName: "Corporate", planModel: "per_room" }),
      ],
      seed: "copy",
    });
    expect(out.results).toHaveLength(3);
    expect(out.changedCount).toBe(2);
  });

  it("uses the smallest cap when a plan spans rooms of different sizes", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [plan({ roomTypes: [
        { roomTypeId: "r1", maxOccupancy: 2, defaultOccupancy: 2 },
        { roomTypeId: "r2", maxOccupancy: 4, defaultOccupancy: 2 },
      ] })],
      seed: "copy",
    });
    // Two rows, not four: the set has to be valid on the 2-guest room too.
    expect(out.results[0]!.after).toBe(2);
  });
});

describe("describeSwitch", () => {
  it("claims the safety property, because it is true and it is what convinces", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room", plans: [plan()], seed: "copy",
    });
    expect(describeSwitch(out, "per_person")).toMatch(/current price stays on the primary/i);
  });

  it("mentions plans it will not touch", () => {
    const out = planPricingModelSwitch({
      target: "per_person", propertyModel: "per_room",
      plans: [plan({ ratePlanId: "a" }), plan({ ratePlanId: "b", planModel: "per_room" })],
      seed: "copy",
    });
    expect(describeSwitch(out, "per_person")).toMatch(/set on their own|is set on its own/i);
  });
});
