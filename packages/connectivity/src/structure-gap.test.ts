import { describe, it, expect } from "vitest";
import { structureGap, describeStructureGap } from "./structure-gap.js";

const rt = (id: string, name: string, active = true) => ({ id, name, active });
const rp = (id: string, name: string, priceLogic = "manual", active = true) => ({ id, name, active, priceLogic });

describe("a product that never reached the channel", () => {
  it("THE BUG: a room type added after provisioning is invisible, and has no row to count", () => {
    // Provisioning is one-shot. "Suite" was added the week after, so it is sellable locally and has
    // no mapping row at all — which is why every `status != complete` counter reports zero and the
    // dashboard shows green while no OTA can see it.
    const r = structureGap({
      roomTypes: [rt("double", "Double"), rt("suite", "Suite")],
      ratePlans: [rp("std", "Standard")],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r.hasGap).toBe(true);
    expect(r.neverSent).toEqual([{ id: "suite", name: "Suite", kind: "roomType" }]);
  });

  it("catches a rate plan added later too", () => {
    const r = structureGap({
      roomTypes: [rt("double", "Double")],
      ratePlans: [rp("std", "Standard"), rp("nr", "Non-Refundable")],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r.neverSent).toEqual([{ id: "nr", name: "Non-Refundable", kind: "ratePlan" }]);
  });

  it("reports nothing when everything has reached the channel", () => {
    const r = structureGap({
      roomTypes: [rt("double", "Double")],
      ratePlans: [rp("std", "Standard")],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r).toMatchObject({ hasGap: false, neverSent: [] });
  });

  it("a fresh property with nothing mapped reports every sellable product", () => {
    const r = structureGap({
      roomTypes: [rt("a", "Double"), rt("b", "Suite")],
      ratePlans: [rp("std", "Standard")],
      mappedRoomTypeIds: [],
      mappedRatePlanIds: [],
    });
    expect(r.neverSent).toHaveLength(3);
  });
});

describe("what is deliberately NOT a gap", () => {
  it("ignores a derived rate plan — Channex never holds one", () => {
    // Provisioning skips derived plans because they follow a parent locally. Counting them would
    // invent a gap nobody can close, and a number you cannot act on is a number you learn to ignore.
    const r = structureGap({
      roomTypes: [rt("double", "Double")],
      ratePlans: [rp("std", "Standard"), rp("bar10", "BAR -10%", "derived")],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r.hasGap).toBe(false);
  });

  it("ignores an inactive room type — not being sold is not a fault", () => {
    const r = structureGap({
      roomTypes: [rt("double", "Double"), rt("old", "Old Annex", false)],
      ratePlans: [rp("std", "Standard")],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r.hasGap).toBe(false);
  });

  it("ignores an inactive rate plan", () => {
    const r = structureGap({
      roomTypes: [rt("double", "Double")],
      ratePlans: [rp("std", "Standard"), rp("gone", "Last Winter", "manual", false)],
      mappedRoomTypeIds: ["double"],
      mappedRatePlanIds: ["std"],
    });
    expect(r.hasGap).toBe(false);
  });

  it("a mapping row that EXISTS but is unfinished is not this question", () => {
    // `neverSent` is the absence of a row. An incomplete row is already counted by the mapping
    // screens — conflating the two would double-report one problem and hide the other.
    const r = structureGap({
      roomTypes: [rt("double", "Double")],
      ratePlans: [rp("std", "Standard")],
      mappedRoomTypeIds: ["double"], // row exists, status irrelevant here
      mappedRatePlanIds: ["std"],
    });
    expect(r.hasGap).toBe(false);
  });
});

describe("the sentence a hotelier reads", () => {
  it("says nothing when there is nothing to say", () => {
    expect(describeStructureGap({ neverSent: [], hasGap: false })).toBeNull();
  });

  it("names one product and what it means", () => {
    const r = structureGap({
      roomTypes: [rt("a", "Sea View Suite")],
      ratePlans: [],
      mappedRoomTypeIds: [],
      mappedRatePlanIds: [],
    });
    const s = describeStructureGap(r)!;
    expect(s).toContain("Sea View Suite");
    expect(s).toMatch(/no OTA can see it/);
  });

  it("names two, then counts the rest rather than listing forever", () => {
    const r = structureGap({
      roomTypes: [rt("a", "Double"), rt("b", "Twin"), rt("c", "Suite"), rt("d", "Studio")],
      ratePlans: [],
      mappedRoomTypeIds: [],
      mappedRatePlanIds: [],
    });
    expect(describeStructureGap(r)).toBe(
      "Double, Twin and 2 more have never reached your channel manager, so no OTA can see them.",
    );
  });
});
