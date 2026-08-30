import { describe, it, expect } from "vitest";
import { resolveRate, resolveStay, type ResolvablePlan, type PriceLookup } from "./resolve-rate.js";
import { defaultOptions, type OccupancyOption } from "./occupancy-options.js";

const D = "2026-09-01";
const RT = "room1";

/** A lookup over a plain table of stored prices. */
const lookupOf = (rows: Record<string, number>): PriceLookup =>
  (rt, rp, d, occ) => rows[`${rt}:${rp}:${d}:${occ}`] ?? null;

const perPersonOptions = (): OccupancyOption[] => [
  { occupancy: 1, isPrimary: false, mode: "derived", rateMinor: null, adjustmentType: "fixed", direction: "decrease", value: 2000 },
  { occupancy: 2, isPrimary: true, mode: "manual", rateMinor: 12000 },
  { occupancy: 3, isPrimary: false, mode: "manual", rateMinor: 14000 },
];

const standard = (o: Partial<ResolvablePlan> = {}): ResolvablePlan => ({
  id: "std", pricingModel: "per_person", primaryOccupancy: 2, options: perPersonOptions(), ...o,
});

const base = (plan: ResolvablePlan, lookup: PriceLookup, plans: ResolvablePlan[] = [plan]) => ({
  lookup, plans: new Map(plans.map((p) => [p.id, p])),
  roomTypeId: RT, maxOccupancy: 3, roomDefaultOccupancy: 2,
  propertyModel: "per_person", plan, dateKey: D,
});

describe("an explicit stored price outranks every rule", () => {
  it("uses the stored price for that exact occupancy", () => {
    const lookup = lookupOf({ [`${RT}:std:${D}:1`]: 8500 });
    expect(resolveRate({ ...base(standard(), lookup), occupancy: 1 })).toBe(8500);
  });
  it("a calendar override on one occupancy does not disturb the others", () => {
    const lookup = lookupOf({ [`${RT}:std:${D}:1`]: 8500 });
    expect(resolveRate({ ...base(standard(), lookup), occupancy: 3 })).toBe(14000);
  });
});

describe("occupancy derivation, with no stored price", () => {
  const lookup = lookupOf({});
  it("returns the primary's own rate at the primary", () => {
    expect(resolveRate({ ...base(standard(), lookup), occupancy: 2 })).toBe(12000);
  });
  it("applies the occupancy rule to the primary", () => {
    expect(resolveRate({ ...base(standard(), lookup), occupancy: 1 })).toBe(10000);
  });
  it("uses a manual row's own price", () => {
    expect(resolveRate({ ...base(standard(), lookup), occupancy: 3 })).toBe(14000);
  });
  it("follows a stored PRIMARY when deriving", () => {
    // Overriding the primary for a date must move every derived occupancy with it.
    const withPrimary = lookupOf({ [`${RT}:std:${D}:2`]: 15000 });
    expect(resolveRate({ ...base(standard(), withPrimary), occupancy: 1 })).toBe(13000);
  });
});

describe("cascade — derived from a parent AND per-person", () => {
  const parent = standard();
  const nonRef: ResolvablePlan = {
    id: "nr", pricingModel: "per_person", primaryOccupancy: 2,
    parentRatePlanId: "std", priceLogic: "derived",
    derivedType: "percent", derivedDirection: "decrease", derivedValue: 20, derivedRounding: "none",
    options: defaultOptions("per_person", 3, null),
  };

  it("takes the parent's price AT THIS OCCUPANCY, then the plan's discount", () => {
    // Standard for 1 guest is 10000; minus 20% is 8000. NOT 12000 − 20% − 2000 = 7600, which is what
    // deriving from the parent's primary and then applying the occupancy offset again would give.
    const lookup = lookupOf({});
    const got = resolveRate({ ...base(nonRef, lookup, [parent, nonRef]), occupancy: 1 });
    expect(got).toBe(8000);
    expect(got).not.toBe(7600);
  });

  it("prices the primary as parent-primary minus the discount", () => {
    expect(resolveRate({ ...base(nonRef, lookupOf({}), [parent, nonRef]), occupancy: 2 })).toBe(9600);
  });

  it("moves with the parent when the parent's stored price changes", () => {
    const lookup = lookupOf({ [`${RT}:std:${D}:1`]: 9000 });
    expect(resolveRate({ ...base(nonRef, lookup, [parent, nonRef]), occupancy: 1 })).toBe(7200);
  });

  it("its own stored override still wins over the cascade", () => {
    const lookup = lookupOf({ [`${RT}:nr:${D}:1`]: 7000 });
    expect(resolveRate({ ...base(nonRef, lookup, [parent, nonRef]), occupancy: 1 })).toBe(7000);
  });

  it("returns null when the parent cannot price that occupancy", () => {
    const orphan: ResolvablePlan = { ...nonRef, parentRatePlanId: "missing" };
    expect(resolveRate({ ...base(orphan, lookupOf({}), [orphan]), occupancy: 1 })).toBeNull();
  });

  it("refuses a derivation cycle instead of recursing until the stack gives out", () => {
    const a: ResolvablePlan = { id: "a", parentRatePlanId: "b", priceLogic: "derived", pricingModel: "per_room", options: defaultOptions("per_room", 3, 100) };
    const b: ResolvablePlan = { id: "b", parentRatePlanId: "a", priceLogic: "derived", pricingModel: "per_room", options: defaultOptions("per_room", 3, 100) };
    expect(resolveRate({ ...base(a, lookupOf({}), [a, b]), occupancy: 2 })).toBeNull();
  });
});

describe("per-room prices the room whatever the party size", () => {
  const perRoom = standard({ pricingModel: "per_room", options: defaultOptions("per_room", 3, 12000), primaryOccupancy: null });

  it("gives the same price for one guest and for three", () => {
    const lookup = lookupOf({});
    const one = resolveRate({ ...base(perRoom, lookup), occupancy: 1 });
    const three = resolveRate({ ...base(perRoom, lookup), occupancy: 3 });
    expect(one).toBe(12000);
    expect(three).toBe(12000);
  });

  it("reads the stored row at the ceiling, which is where occupancyKeysFor writes it", () => {
    const lookup = lookupOf({ [`${RT}:std:${D}:3`]: 13500 });
    expect(resolveRate({ ...base(perRoom, lookup), occupancy: 1 })).toBe(13500);
  });
});

describe("party sizes that do not fit", () => {
  it("returns null above the room's maximum rather than a price", () => {
    expect(resolveRate({ ...base(standard(), lookupOf({})), occupancy: 4 })).toBeNull();
  });
  it("returns null below one", () => {
    expect(resolveRate({ ...base(standard(), lookupOf({})), occupancy: 0 })).toBeNull();
  });
  it("returns null — not zero — when a plan has no options at all", () => {
    const bare = standard({ options: [] });
    expect(resolveRate({ ...base(bare, lookupOf({})), occupancy: 2 })).toBeNull();
  });
});

describe("resolveStay", () => {
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const plan = standard();

  it("sums every night at the requested occupancy", () => {
    const lookup: PriceLookup = () => null;
    const stay = resolveStay({ ...base(plan, lookup), occupancy: 1 }, dates)!;
    expect(stay.totalMinor).toBe(30000);
    expect(stay.nights).toHaveLength(3);
  });

  it("respects a single night's override inside the stay", () => {
    const lookup = lookupOf({ [`${RT}:std:2026-09-02:1`]: 15000 });
    expect(resolveStay({ ...base(plan, lookup), occupancy: 1 }, dates)!.totalMinor).toBe(35000);
  });

  it("returns NULL for the whole stay if one night cannot be priced", () => {
    // A stay with a missing night is not cheaper, it is wrong — and the guest pays the difference
    // at the desk.
    const gappy = standard({ options: [{ occupancy: 2, isPrimary: true, mode: "manual", rateMinor: 12000 }] });
    expect(resolveStay({ ...base(gappy, lookupOf({})), occupancy: 1 }, dates)).toBeNull();
  });
});
