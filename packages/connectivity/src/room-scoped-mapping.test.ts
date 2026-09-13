import { describe, it, expect } from "vitest";
import { collidingExternalIds, ratePlanMappingRows, unconfirmedPairs, type ExistingRateMapping } from "./mapping-rows.js";

const ROOMS = [
  { id: "r1", name: "Apartment, 1 Bedroom", active: true },
  { id: "r2", name: "Apartment, 2 Bedrooms", active: true },
  { id: "r3", name: "Apartment, 3 Bedrooms", active: true },
];
const PLANS = [
  { id: "flex", name: "BB Flex", active: true, priceLogic: "manual" },
  { id: "nr", name: "BB Non-Refundable", active: true, priceLogic: "manual" },
  { id: "std", name: "Standard Rate", active: false, priceLogic: "manual" },
  { id: "deriv", name: "BB Mobile", active: true, priceLogic: "derived" },
];
// Every plan sells on every room, which is the Cabacum shape.
const sellsOn = () => true;

const rows = (existing: ExistingRateMapping[] = []) =>
  ratePlanMappingRows({ roomTypes: ROOMS, ratePlans: PLANS, sellsOn, existing });

describe("ratePlanMappingRows", () => {
  it("⚠️ produces one row per (room type, rate plan) — the shape Channex actually has", () => {
    // 3 rooms × 2 active manual plans. This is the whole fix for BUG-019: a property-wide list
    // cannot express a per-room model, so every price funnelled into one room's rate plan.
    const r = rows();
    expect(r).toHaveLength(6);
    expect(r.filter((x) => x.roomTypeId === "r1").map((x) => x.ratePlanName).sort())
      .toEqual(["BB Flex", "BB Non-Refundable"]);
  });

  it("never offers a derived plan — it follows its parent", () => {
    expect(rows().some((x) => x.ratePlanId === "deriv")).toBe(false);
  });

  it("hides an inactive plan that maps nowhere", () => {
    expect(rows().some((x) => x.ratePlanId === "std")).toBe(false);
  });

  it("⚠️ KEEPS an inactive plan that still has a live mapping", () => {
    // It is currently being pushed. Hiding it leaves the hotel unable to see or undo something
    // live — which is exactly BUG-020's Standard Rate.
    const r = rows([{ id: "m1", ratePlanId: "std", roomTypeId: "r1", externalId: "0ea321e7", status: "complete" }]);
    const std = r.filter((x) => x.ratePlanId === "std");
    expect(std).toHaveLength(1);
    expect(std[0]!.roomTypeId).toBe("r1");
  });

  it("⚠️ a CATCH-ALL row reads as unconfirmed, never as complete", () => {
    /*
     * The €666 fault. `BB Flex` with roomTypeId NULL still pushes — resolveExternalRateId falls
     * back to it — so it cannot be hidden. But showing it green is what let three room types
     * publish to one place for days with the screen saying everything was mapped.
     */
    const r = rows([{ id: "m1", ratePlanId: "flex", roomTypeId: null, externalId: "cb75de7d", status: "complete" }]);
    const flex = r.filter((x) => x.ratePlanId === "flex");
    expect(flex).toHaveLength(3);
    for (const row of flex) {
      expect(row.status).toBe("unconfirmed");
      expect(row.fromCatchAll).toBe(true);
      expect(row.unmapped).toBe(true);
      /*
       * ⚠️ Nothing is prefilled. For the 1-Bedroom the inherited id IS the 2-Bedroom's rate plan,
       * so offering it as the value to save would invite the hotel to confirm the exact fault this
       * screen exists to end — in one click, believing they had checked it. It is shown as context
       * and nothing more.
       */
      expect(row.id).toBeNull();
      expect(row.externalId).toBeNull();
      expect(row.inheritedExternalId).toBe("cb75de7d");
    }
  });

  it("a room-specific row wins over a catch-all for the same plan", () => {
    const r = rows([
      { id: "catch", ratePlanId: "flex", roomTypeId: null, externalId: "wrong", status: "complete" },
      { id: "exact", ratePlanId: "flex", roomTypeId: "r1", externalId: "right", status: "complete" },
    ]);
    const r1 = r.find((x) => x.roomTypeId === "r1" && x.ratePlanId === "flex")!;
    expect(r1.id).toBe("exact");
    expect(r1.externalId).toBe("right");
    expect(r1.status).toBe("complete");
    expect(r1.fromCatchAll).toBe(false);
    // The other rooms still inherit the catch-all, and still say so.
    expect(r.find((x) => x.roomTypeId === "r2" && x.ratePlanId === "flex")!.status).toBe("unconfirmed");
  });

  it("a pair never sent is its own state, mappable like any other", () => {
    const r = rows().find((x) => x.roomTypeId === "r3" && x.ratePlanId === "nr")!;
    expect(r).toMatchObject({ id: null, status: "never_sent", unmapped: true, externalId: null });
  });

  it("a mapped row with no external id is incomplete, not complete", () => {
    const r = rows([{ id: "m1", ratePlanId: "nr", roomTypeId: "r1", externalId: null, status: "complete" }]);
    expect(r.find((x) => x.roomTypeId === "r1" && x.ratePlanId === "nr")!.status).toBe("incomplete");
  });

  it("skips an inactive room type entirely", () => {
    const r = ratePlanMappingRows({
      roomTypes: [{ id: "r1", name: "Gone", active: false }], ratePlans: PLANS, sellsOn, existing: [],
    });
    expect(r).toHaveLength(0);
  });

  it("only lists plans the room actually sells", () => {
    const r = ratePlanMappingRows({
      roomTypes: ROOMS, ratePlans: PLANS, existing: [],
      sellsOn: (roomTypeId, ratePlanId) => !(roomTypeId === "r3" && ratePlanId === "nr"),
    });
    expect(r.some((x) => x.roomTypeId === "r3" && x.ratePlanId === "nr")).toBe(false);
    expect(r).toHaveLength(5);
  });

  it("counts everything still needing a human, catch-alls included", () => {
    const r = rows([{ id: "m1", ratePlanId: "flex", roomTypeId: null, externalId: "cb75de7d", status: "complete" }]);
    // 3 unconfirmed (flex, inherited) + 3 never_sent (nr) = 6
    expect(unconfirmedPairs(r)).toBe(6);
  });
});

describe("the €666 fault, as a regression", () => {
  it("⚠️ reproduces what production actually held on 13 September 2026", async () => {
    const { indexRateMappings, resolveExternalRateId } = await import("./rate-mapping.js");

    /*
     * The exact rows read from the production database:
     *
     *   BB Flex            roomTypeId = NULL  →  cb75de7d…   (the 2-Bedroom's BB BAR in Channex)
     *   BB Non-Refundable  (no mapping)
     *
     * A price set on the 1-Bedroom resolved to the 2-Bedroom's Channex rate plan and published
     * there. Silently — the push succeeded and the Sync Center was green.
     */
    const broken = indexRateMappings([
      { ratePlanId: "flex", roomTypeId: null, externalRateId: "cb75de7d" },
    ]);
    expect(resolveExternalRateId(broken, "1-bedroom", "flex")).toBe("cb75de7d");
    expect(resolveExternalRateId(broken, "2-bedroom", "flex")).toBe("cb75de7d");
    expect(resolveExternalRateId(broken, "3-bedroom", "flex")).toBe("cb75de7d");

    // Every room type funnels into ONE Channex rate plan. That is the whole bug, in one assertion.
    const targets = new Set(
      ["1-bedroom", "2-bedroom", "3-bedroom"].map((rt) => resolveExternalRateId(broken, rt, "flex")),
    );
    expect(targets.size).toBe(1);

    // Room-scoped rows fix it without touching the resolver — it already preferred them.
    const fixed = indexRateMappings([
      { ratePlanId: "flex", roomTypeId: "1-bedroom", externalRateId: "ae6b1ed1" },
      { ratePlanId: "flex", roomTypeId: "2-bedroom", externalRateId: "cb75de7d" },
      { ratePlanId: "flex", roomTypeId: "3-bedroom", externalRateId: "d383225c" },
    ]);
    expect(new Set(
      ["1-bedroom", "2-bedroom", "3-bedroom"].map((rt) => resolveExternalRateId(fixed, rt, "flex")),
    ).size).toBe(3);
    expect(resolveExternalRateId(fixed, "1-bedroom", "flex")).toBe("ae6b1ed1");
  });

  it("an unmapped pair pushes NOTHING rather than guessing", async () => {
    const { indexRateMappings, resolveExternalRateId } = await import("./rate-mapping.js");
    // BB Non-Refundable had no row at all. Null is the safe answer: skip the pair. Falling back to
    // a same-named plan on another room is precisely how €666 was published.
    const idx = indexRateMappings([{ ratePlanId: "flex", roomTypeId: "1-bedroom", externalRateId: "ae6b1ed1" }]);
    expect(resolveExternalRateId(idx, "1-bedroom", "nr")).toBeNull();
  });
});

describe("confirming one room never strips the others", () => {
  it("⚠️ a room-specific save leaves the catch-all covering the rooms not yet confirmed", () => {
    // Mid-cleanup is the dangerous moment. If confirming the 1-Bedroom mutated the catch-all, the
    // 2- and 3-Bedroom would stop pushing at all — a second silent fault introduced by fixing the
    // first. They keep publishing exactly what they did, and the screen keeps saying so.
    const after = ratePlanMappingRows({
      roomTypes: ROOMS, ratePlans: PLANS, sellsOn,
      existing: [
        { id: "catch", ratePlanId: "flex", roomTypeId: null, externalId: "cb75de7d", status: "complete" },
        { id: "new1", ratePlanId: "flex", roomTypeId: "r1", externalId: "ae6b1ed1", status: "complete" },
      ],
    });
    expect(after.find((x) => x.roomTypeId === "r1" && x.ratePlanId === "flex")!.status).toBe("complete");
    for (const rt of ["r2", "r3"]) {
      const row = after.find((x) => x.roomTypeId === rt && x.ratePlanId === "flex")!;
      expect(row.status).toBe("unconfirmed");
      expect(row.inheritedExternalId).toBe("cb75de7d");
    }
  });
});

describe("collidingExternalIds", () => {
  it("⚠️ catches two room types bound to ONE Channex rate plan", () => {
    /*
     * Production, 13 Sept: `Standard Rate` held two rows for two different room types, both
     * pointing at 0ea321e7…. The log called it a duplicate row — a duplicate would be harmless.
     * This is two rooms publishing to one place, so one silently overwrites the other on every
     * push, and the later one wins.
     */
    const r = ratePlanMappingRows({
      roomTypes: ROOMS, ratePlans: PLANS, sellsOn,
      existing: [
        { id: "a", ratePlanId: "flex", roomTypeId: "r1", externalId: "0ea321e7", status: "complete" },
        { id: "b", ratePlanId: "flex", roomTypeId: "r2", externalId: "0ea321e7", status: "complete" },
      ],
    });
    const clashes = collidingExternalIds(r);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]!.externalId).toBe("0ea321e7");
    expect(clashes[0]!.rooms.map((x) => x.roomTypeName).sort())
      .toEqual(["Apartment, 1 Bedroom", "Apartment, 2 Bedrooms"]);
  });

  it("says nothing when every room has its own Channex plan — the correct shape", () => {
    const r = ratePlanMappingRows({
      roomTypes: ROOMS, ratePlans: PLANS, sellsOn,
      existing: [
        { id: "a", ratePlanId: "flex", roomTypeId: "r1", externalId: "ae6b1ed1", status: "complete" },
        { id: "b", ratePlanId: "flex", roomTypeId: "r2", externalId: "cb75de7d", status: "complete" },
        { id: "c", ratePlanId: "flex", roomTypeId: "r3", externalId: "d383225c", status: "complete" },
      ],
    });
    expect(collidingExternalIds(r)).toEqual([]);
  });

  it("ignores unmapped rows rather than treating 'no id' as a shared one", () => {
    expect(collidingExternalIds(rows())).toEqual([]);
  });
});

describe("a real channel never falls back to a property-wide mapping", () => {
  it("⚠️ refuses the catch-all that published €666 against the wrong room", async () => {
    const { indexRateMappings, resolveExternalRateId } = await import("./rate-mapping.js");
    const rows = [{ ratePlanId: "flex", roomTypeId: null, externalRateId: "cb75de7d" }];

    // Mock channel: a catch-all is the normal shape, and its adapter reads back its own ids.
    const mock = indexRateMappings(rows, { allowCatchAll: true });
    expect(resolveExternalRateId(mock, "1-bedroom", "flex")).toBe("cb75de7d");

    /*
     * Real channel: the pair resolves to NOTHING rather than to another room's rate plan.
     *
     * Skipping is reported as unmapped and shows on the Mapping screen. Publishing through the
     * catch-all is invisible until somebody books at the wrong price — which is why "no price" is
     * the safer failure of the two.
     */
    const real = indexRateMappings(rows, { allowCatchAll: false });
    expect(resolveExternalRateId(real, "1-bedroom", "flex")).toBeNull();
    expect(resolveExternalRateId(real, "2-bedroom", "flex")).toBeNull();
  });

  it("a room-specific row still resolves on a real channel — that is the whole point", async () => {
    const { indexRateMappings, resolveExternalRateId } = await import("./rate-mapping.js");
    const idx = indexRateMappings(
      [{ ratePlanId: "flex", roomTypeId: "1-bedroom", externalRateId: "ae6b1ed1" }],
      { allowCatchAll: false },
    );
    expect(resolveExternalRateId(idx, "1-bedroom", "flex")).toBe("ae6b1ed1");
  });

  it("defaults to allowing it, so every existing caller is unchanged", async () => {
    const { indexRateMappings, resolveExternalRateId } = await import("./rate-mapping.js");
    const idx = indexRateMappings([{ ratePlanId: "flex", roomTypeId: null, externalRateId: "x" }]);
    expect(resolveExternalRateId(idx, "any-room", "flex")).toBe("x");
  });
});
