import { describe, expect, it } from "vitest";
import { reviocrsSetup, reviolinkSetup, reviopmsSetup, type SetupFacts } from "./setup.js";

/** A hotel the operator has just provisioned: property + owner + one base rate plan, nothing else. */
const BRAND_NEW: SetupFacts = {
  roomTypes: 0,
  ratePlans: 1,
  hasRates: false,
  channels: 0,
  mappingComplete: false,
  units: 0,
  staff: 1,
  hasTaxes: false,
  catalogItems: 0,
  reservations: 0,
};

/** A hotel already trading on RevioLink: rooms and prices exist, channels are mapped. */
const ON_REVIOLINK: SetupFacts = {
  ...BRAND_NEW,
  roomTypes: 6,
  ratePlans: 3,
  hasRates: true,
  channels: 2,
  mappingComplete: true,
};

const ALL_SETUPS = [
  ["RevioLink", reviolinkSetup],
  ["RevioCRS", reviocrsSetup],
  ["RevioPMS", reviopmsSetup],
] as const;

describe("nobody starts at zero", () => {
  it.each(ALL_SETUPS)("%s opens a brand-new hotel above zero", (_name, setup) => {
    const p = setup(BRAND_NEW);
    expect(p.done).toBeGreaterThan(0);
  });

  it.each(ALL_SETUPS)("%s counts five steps, not four", (_name, setup) => {
    expect(setup(BRAND_NEW).total).toBe(5);
  });

  it("the head start is a fact, not a flourish — the property really was created", () => {
    // If this ever ticks something the operator did NOT do, the whole device becomes dishonest.
    const first = reviolinkSetup(BRAND_NEW).steps[0]!;
    expect(first.key).toBe("property");
    expect(first.done).toBe(true);
    expect(first.providedForYou).toBe(true);
  });

  it("does not point a brand-new hotel at the step already done for them", () => {
    expect(reviolinkSetup(BRAND_NEW).next?.key).toBe("room-types");
  });
});

describe("cross-product credit", () => {
  it("a hotel already on RevioLink opens RevioCRS well past the start", () => {
    const solo = reviocrsSetup({ ...BRAND_NEW });
    const expanding = reviocrsSetup({ ...ON_REVIOLINK, alsoRuns: ["RevioLink"] });
    expect(expanding.done).toBeGreaterThan(solo.done);
    expect(expanding.done).toBe(3); // property + room types + rates
  });

  it("names the product that already did the work", () => {
    const p = reviocrsSetup({ ...ON_REVIOLINK, alsoRuns: ["RevioLink"] });
    const rooms = p.steps.find((s) => s.key === "room-types")!;
    expect(rooms.done).toBe(true);
    expect(rooms.inheritedFrom).toBe("RevioLink");
  });

  it("lists what they did not have to do", () => {
    const p = reviocrsSetup({ ...ON_REVIOLINK, alsoRuns: ["RevioLink"] });
    expect(p.inherited.map((s) => s.key).sort()).toEqual(["rates", "room-types"]);
  });

  it("RevioPMS inherits room types too", () => {
    const p = reviopmsSetup({ ...ON_REVIOLINK, alsoRuns: ["RevioLink"] });
    expect(p.steps.find((s) => s.key === "room-types")?.inheritedFrom).toBe("RevioLink");
  });

  it("credits nothing to a product the hotel does not run", () => {
    // A CRS-only hotel created its own room types. Telling it they came from RevioLink would be a
    // lie about software it has never seen.
    const p = reviocrsSetup({ ...ON_REVIOLINK });
    expect(p.steps.find((s) => s.key === "room-types")?.inheritedFrom).toBeUndefined();
    expect(p.inherited).toHaveLength(0);
  });

  it("credits nothing for a step that is not actually done", () => {
    const p = reviocrsSetup({ ...BRAND_NEW, alsoRuns: ["RevioLink"] });
    expect(p.steps.find((s) => s.key === "room-types")?.inheritedFrom).toBeUndefined();
  });

  it("never marks a product's OWN exclusive step as inherited", () => {
    // Connecting a channel is RevioLink's alone; no other product can have done it.
    const p = reviolinkSetup({ ...ON_REVIOLINK, alsoRuns: ["RevioCRS", "RevioPMS"] });
    expect(p.steps.find((s) => s.key === "channels")?.inheritedFrom).toBeUndefined();
    expect(p.steps.find((s) => s.key === "mapping")?.inheritedFrom).toBeUndefined();
  });
});

describe("completion", () => {
  it("a fully configured hotel is complete on every product", () => {
    const ready: SetupFacts = {
      roomTypes: 6, ratePlans: 3, hasRates: true, channels: 2, mappingComplete: true,
      units: 24, staff: 4, hasTaxes: true, catalogItems: 12, reservations: 40,
    };
    for (const [, setup] of ALL_SETUPS) {
      const p = setup(ready);
      expect(p.complete).toBe(true);
      expect(p.next).toBeNull();
      expect(p.done).toBe(p.total);
    }
  });

  it("is not complete while one step remains", () => {
    const p = reviolinkSetup({ ...ON_REVIOLINK, mappingComplete: false });
    expect(p.complete).toBe(false);
    expect(p.next?.key).toBe("mapping");
  });
});

describe("shape", () => {
  it.each(ALL_SETUPS)("%s gives every step somewhere to go", (_name, setup) => {
    for (const s of setup(BRAND_NEW).steps) {
      expect(s.href.startsWith("/")).toBe(true);
      expect(s.cta.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_SETUPS)("%s uses unique step keys", (_name, setup) => {
    const keys = setup(BRAND_NEW).steps.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("omits inheritedFrom entirely rather than setting it undefined", () => {
    // A present-but-undefined key would make `inherited` count steps nobody inherited.
    const rooms = reviocrsSetup(ON_REVIOLINK).steps.find((s) => s.key === "room-types")!;
    expect("inheritedFrom" in rooms).toBe(false);
  });
});
