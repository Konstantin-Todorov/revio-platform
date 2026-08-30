import { describe, it, expect } from "vitest";
import { resolveRate, type PriceLookup, type ResolvablePlan } from "@revio/core";
import { toRestrictionValue } from "./channex-mappers.js";

/**
 * The claim OBP rests on, tested as a claim.
 *
 * *"One per-room surface left behind produces the classic parity failure — guest sees one price on
 * the booking engine, the OTA shows another, the folio bills a third."*
 *
 * Every surface resolves through `resolveRate`, so this proves the number that reaches Channex is
 * the number a guest is quoted. Not by inspecting both implementations and agreeing they look alike
 * — by computing both and asserting they are equal.
 */

const RT = "room1";
const D = "2026-09-14";

const standard: ResolvablePlan = {
  id: "std",
  pricingModel: "per_person",
  primaryOccupancy: 2,
  options: [
    { occupancy: 1, isPrimary: false, mode: "derived", rateMinor: null, adjustmentType: "fixed", direction: "decrease", value: 2500 },
    { occupancy: 2, isPrimary: true, mode: "manual", rateMinor: 13000 },
    { occupancy: 3, isPrimary: false, mode: "manual", rateMinor: 15500 },
  ],
};

const plans = new Map([[standard.id, standard]]);
const lookup: PriceLookup = () => null;

const quote = (occupancy: number) =>
  resolveRate({
    lookup, plans, roomTypeId: RT, maxOccupancy: 3, roomDefaultOccupancy: 2,
    propertyModel: "per_person", plan: standard, dateKey: D, occupancy,
  });

describe("what the guest is quoted is what the OTA is told", () => {
  it("every occupancy the booking engine would quote appears in the Channex payload, unchanged", () => {
    // The booking engine's side: one number per party size.
    const quoted = [1, 2, 3].map((occ) => ({ occupancy: occ, minor: quote(occ) }));
    expect(quoted).toEqual([
      { occupancy: 1, minor: 10500 },
      { occupancy: 2, minor: 13000 },
      { occupancy: 3, minor: 15500 },
    ]);

    // The push's side: the same numbers, through the mapper that talks to Channex.
    const value = toRestrictionValue("prop", {
      externalRoomId: "r", externalRateId: "rp", date: D, currency: "EUR",
      occupancyRates: quoted, primaryOccupancy: 2, restrictions: {},
    })!;

    expect(value.rates).toEqual([
      { occupancy: 1, rate: 10500 },
      { occupancy: 2, rate: 13000 },
      { occupancy: 3, rate: 15500 },
    ]);
    // And never a scalar beside the array — that is the field Channex would pick instead.
    expect(value.rate).toBeUndefined();
  });

  it("a per-room plan sends the scalar, and it is the same number too", () => {
    const perRoom: ResolvablePlan = {
      id: "pr", pricingModel: "per_room", primaryOccupancy: null,
      options: [{ occupancy: 3, isPrimary: true, mode: "manual", rateMinor: 14000 }],
    };
    const price = resolveRate({
      lookup, plans: new Map([[perRoom.id, perRoom]]), roomTypeId: RT,
      maxOccupancy: 3, roomDefaultOccupancy: 2, propertyModel: "per_room",
      plan: perRoom, dateKey: D, occupancy: 3,
    });
    const value = toRestrictionValue("prop", {
      externalRoomId: "r", externalRateId: "rp", date: D, currency: "EUR",
      priceMinor: price!, restrictions: {},
    })!;
    expect(value.rate).toBe(14000);
    expect(value.rates).toBeUndefined();
  });

  it("restrictions ride at the top of the object, never inside the rates array", () => {
    const value = toRestrictionValue("prop", {
      externalRoomId: "r", externalRateId: "rp", date: D, currency: "EUR",
      occupancyRates: [{ occupancy: 1, minor: 10500 }, { occupancy: 2, minor: 13000 }],
      primaryOccupancy: 2,
      restrictions: { minLos: 2, stopSell: false, cta: true },
    })!;
    expect(value.min_stay_arrival).toBe(2);
    expect(value.closed_to_arrival).toBe(true);
    expect(value.rates).toHaveLength(2);
    // Channex has no occupancy dimension on restrictions, so there is nowhere else they could go.
    expect(JSON.stringify(value.rates)).not.toMatch(/min_stay|closed_to/);
  });

  it("an unpriced occupancy is dropped from the push rather than sent as zero", () => {
    // Channex rejects a zero rate per-object inside an HTTP 200 — the silent rejection.
    const value = toRestrictionValue("prop", {
      externalRoomId: "r", externalRateId: "rp", date: D, currency: "EUR",
      occupancyRates: [{ occupancy: 1, minor: null }, { occupancy: 2, minor: 13000 }],
      primaryOccupancy: 2, restrictions: {},
    })!;
    expect(value.rates).toEqual([{ occupancy: 2, rate: 13000 }]);
  });
});
