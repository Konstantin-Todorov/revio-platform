import { describe, it, expect } from "vitest";
import { displayedRate, rateSourceNote, toResolvablePlan, type PlanRow } from "./displayed-rate.js";
import type { PriceLookup, ResolvablePlan } from "./resolve-rate.js";

const D = "2026-11-02";
const RT = "double";
const lookupOf = (rows: Record<string, number>): PriceLookup => (rt, rp, d, occ) => rows[`${rt}:${rp}:${d}:${occ}`] ?? null;

// The shape onboarding writes: a per-room plan whose default is €120 at the room's ceiling.
const std: ResolvablePlan = {
  id: "std", pricingModel: "per_room", primaryOccupancy: null, priceLogic: "manual",
  options: [{ occupancy: 2, isPrimary: true, mode: "manual", rateMinor: 12000 }],
};
const nonRef: ResolvablePlan = {
  id: "nr", pricingModel: "per_room", primaryOccupancy: null, priceLogic: "derived", parentRatePlanId: "std",
  derivedType: "percent", derivedDirection: "decrease", derivedValue: 10, derivedRounding: "none", options: [],
};
const bare: ResolvablePlan = { id: "bare", pricingModel: "per_room", priceLogic: "manual", options: [] };
const plans = new Map([std, nonRef, bare].map((p) => [p.id, p]));
const cell = (plan: ResolvablePlan, lookup: PriceLookup, defaultOcc: number | null = null) => displayedRate({
  lookup, plans, plan, roomTypeId: RT, maxOccupancy: 2, roomDefaultOccupancy: defaultOcc, propertyModel: "per_room", dateKey: D,
});

describe("displayedRate — the calendar says what the channel is sent", () => {
  it("a night nobody priced shows the plan default, not a dash (the sandbox finding)", () => {
    expect(cell(std, lookupOf({}))).toEqual({ minor: 12000, source: "default" });
  });
  it("a stored price is an override", () => {
    expect(cell(std, lookupOf({ [`${RT}:std:${D}:2`]: 9900 }))).toEqual({ minor: 9900, source: "set" });
  });
  it("a derived plan follows its parent's DEFAULT too — it used to show a dash when the parent had no row", () => {
    expect(cell(nonRef, lookupOf({}))).toEqual({ minor: 10800, source: "derived" });
  });
  it("a per-room price stored at the ceiling is found even when the room's default occupancy is lower", () => {
    // RevioLink filtered prices by defaultOccupancy ?? maxGuests, so this row at 2 was invisible for a room defaulting to 1.
    expect(cell(std, lookupOf({ [`${RT}:std:${D}:2`]: 9900 }), 1)).toEqual({ minor: 9900, source: "set" });
  });
  it("only a plan with no price and no default is really unpriced", () => {
    expect(cell(bare, lookupOf({}))).toEqual({ minor: null, source: "none" });
  });
});

describe("rateSourceNote", () => {
  it("says nothing about a price somebody set", () => {
    expect(rateSourceNote("set", "Standard")).toBeNull();
  });
  it("tells the hotel a default is what the channels are sent", () => {
    expect(rateSourceNote("default", "Standard")).toMatch(/default rate.*channels are sent/);
  });
});

describe("toResolvablePlan", () => {
  it("maps a database row with options, reading an unknown mode as manual", () => {
    const row: PlanRow = {
      id: "p", pricingModel: null, primaryOccupancy: 2, parentRatePlanId: null, priceLogic: "manual",
      derivedType: null, derivedDirection: null, derivedValue: null, derivedRounding: null,
      derivedFloorMinor: null, derivedCeilingMinor: null,
      occupancyOptions: [{ occupancy: 2, isPrimary: true, mode: "weird", rateMinor: 100, adjustmentType: null, direction: null, value: null, rounding: "none" }],
    };
    expect(toResolvablePlan(row).options?.[0]?.mode).toBe("manual");
  });
});
