import { describe, it, expect } from "vitest";
import { planStructureSync, describeStructurePlan, planCoversRoom } from "./structure-plan.js";

const room = (id: string, name: string, active = true) => ({ id, name, active, totalRooms: 5, maxGuests: 2 });
const plan = (id: string, name: string, roomTypeIds: string[] = [], priceLogic = "manual", active = true) =>
  ({ id, name, active, priceLogic, roomTypeIds });

const base = {
  mappedRoomTypeIds: [] as string[],
  mappedPairKeys: [] as string[],
  channexRoomTypes: [] as { id: string; title: string }[],
  channexRatePlans: [] as { id: string; title: string; roomTypeChannexId?: string | null }[],
};

describe("adopt before you create — the rule that prevents a permanent duplicate", () => {
  it("adopts a room type Channex already has, instead of creating a second one", () => {
    // Provisioning writes the room type and THEN the mapping. A failure between the two leaves it
    // created and unmapped — creating it again is how a hotel ends up existing twice, silently.
    const p = planStructureSync({
      ...base,
      roomTypes: [room("suite", "Suite")],
      ratePlans: [],
      channexRoomTypes: [{ id: "cx-suite", title: "Suite" }],
    });
    expect(p.actions).toEqual([{ kind: "adopt-room", localId: "suite", name: "Suite", channexId: "cx-suite" }]);
  });

  it("matches a title regardless of case and surrounding space", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("suite", "  Sea View Suite ")],
      ratePlans: [],
      channexRoomTypes: [{ id: "cx", title: "sea view suite" }],
    });
    expect(p.actions[0]!.kind).toBe("adopt-room");
  });

  it("creates only when Channex genuinely does not have it", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("suite", "Suite")],
      ratePlans: [],
      channexRoomTypes: [{ id: "cx-double", title: "Double" }],
    });
    expect(p.actions).toEqual([
      { kind: "create-room", localId: "suite", name: "Suite", totalRooms: 5, maxGuests: 2 },
    ]);
  });
});

describe("a rate plan is needed once per (room type × plan) pair", () => {
  it("THE MISPRICING BUG: three room types and one plan needs three Channex rate plans", () => {
    // Channex ties a rate plan to exactly one room type; we model plans at property level. Sending
    // one means the last write wins and two room types are mispriced on every OTA — all green.
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double"), room("b", "Twin"), room("c", "Suite")],
      ratePlans: [plan("std", "Standard")],
    });
    const rates = p.actions.filter((a) => a.kind === "create-rate");
    expect(rates).toHaveLength(3);
    expect(rates.map((r: any) => r.localRoomId).sort()).toEqual(["a", "b", "c"]);
  });

  it("respects a plan scoped to specific room types", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double"), room("b", "Suite")],
      ratePlans: [plan("nr", "Non-Refundable", ["b"])],
    });
    const rates = p.actions.filter((a) => a.kind === "create-rate");
    expect(rates).toHaveLength(1);
    expect((rates[0] as any).localRoomId).toBe("b");
  });

  it("an unscoped plan means every room type", () => {
    expect(planCoversRoom(plan("p", "P", []), "anything")).toBe(true);
    expect(planCoversRoom(plan("p", "P", ["a"]), "b")).toBe(false);
  });

  it("adopts a rate plan only when the title matches ON THE SAME room type", () => {
    // Their rate plan titles repeat across room types, so a title alone is ambiguous. Adopting on
    // title alone would map two room types to one Channex rate plan — the mispricing bug again.
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double")],
      ratePlans: [plan("std", "Standard")],
      channexRoomTypes: [{ id: "cx-a", title: "Double" }],
      channexRatePlans: [{ id: "cx-std-other", title: "Standard", roomTypeChannexId: "cx-SOMEONE-ELSE" }],
    });
    expect(p.actions.find((a) => a.kind.endsWith("rate"))!.kind).toBe("create-rate");
  });

  it("adopts when the title AND the room type both match", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double")],
      ratePlans: [plan("std", "Standard")],
      mappedRoomTypeIds: ["a"],
      channexRoomTypes: [{ id: "cx-a", title: "Double" }],
      channexRatePlans: [{ id: "cx-std", title: "Standard", roomTypeChannexId: "cx-a" }],
    });
    expect(p.actions).toEqual([
      { kind: "adopt-rate", localRoomId: "a", localPlanId: "std", label: "Double · Standard", channexId: "cx-std" },
    ]);
  });
});

describe("what the plan leaves alone", () => {
  it("skips anything already mapped", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double")],
      ratePlans: [plan("std", "Standard")],
      mappedRoomTypeIds: ["a"],
      mappedPairKeys: ["a|std"],
    });
    expect(p.isEmpty).toBe(true);
  });

  it("skips derived rate plans — Channex never holds one", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double")],
      ratePlans: [plan("bar", "BAR -10%", [], "derived")],
      mappedRoomTypeIds: ["a"],
    });
    expect(p.isEmpty).toBe(true);
  });

  it("skips inactive room types and inactive plans", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("old", "Old Annex", false)],
      ratePlans: [plan("gone", "Last Winter", [], "manual", false)],
    });
    expect(p.isEmpty).toBe(true);
  });
});

describe("the preview sentence", () => {
  it("says there is nothing to do", () => {
    expect(describeStructurePlan({ actions: [], isEmpty: true })).toMatch(/already on your channel manager/i);
  });

  it("separates what it will create from what it will merely link", () => {
    const p = planStructureSync({
      ...base,
      roomTypes: [room("a", "Double"), room("b", "Suite")],
      ratePlans: [],
      channexRoomTypes: [{ id: "cx-a", title: "Double" }],
    });
    // Double exists there (link it); Suite does not (create it).
    expect(describeStructurePlan(p)).toBe("This will create 1 product and link 1 that already exists there.");
  });
});
