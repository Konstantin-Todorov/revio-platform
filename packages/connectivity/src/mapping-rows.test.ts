import { describe, expect, it } from "vitest";
import { mappingRows, unmappedCount, type ExistingMapping, type MappableProduct } from "./mapping-rows.js";

/**
 * The Mapping screen's row list, pinned against the configuration that produced the report.
 *
 * Cabacum Beach Residence, 2026-09-12: three room types and three rate plans, connected to Channex
 * before two of the room types and both live rate plans existed. The screen listed mapping ROWS, and
 * provisioning is one-shot, so it offered two room types to map and two rate-plan rows both naming a
 * plan the hotel had switched off. Nothing was broken in the mapping write — the products were
 * invisible because they had never been sent.
 */

const ROOMS: MappableProduct[] = [
  { id: "rt-apa", name: "Apartment, 3 Bedrooms", active: true },
  { id: "rt-apa2", name: "Apartment, 2 Bedrooms", active: true },
  // The one that was missing from the screen. Added after the channel was connected.
  { id: "rt-1br", name: "Apartment, 1 Bedroom", active: true },
];

const PLANS: MappableProduct[] = [
  { id: "rp-bar", name: "Standard Rate", active: false, priceLogic: "manual" },
  { id: "rp-bb48", name: "BB Flex", active: true, priceLogic: "manual" },
  { id: "rp-bbnr", name: "BB Non-Refundable", active: true, priceLogic: "manual" },
];

/** What provisioning had actually created: the two original rooms, and the old BAR plan. */
const PROVISIONED_ROOMS: ExistingMapping[] = [
  { id: "m1", productId: "rt-apa", externalId: "cx-apa", status: "complete" },
  { id: "m2", productId: "rt-apa2", externalId: "cx-apa2", status: "complete" },
];
const PROVISIONED_PLANS: ExistingMapping[] = [
  { id: "m3", productId: "rp-bar", externalId: "cx-bar", status: "complete" },
];

describe("the reported configuration", () => {
  it("lists all three room types, including the one never sent to the channel", () => {
    const rows = mappingRows(ROOMS, PROVISIONED_ROOMS, "room");
    expect(rows.map((r) => r.productId)).toEqual(["rt-apa", "rt-apa2", "rt-1br"]);
    expect(rows[2]).toMatchObject({ id: null, status: "never_sent", unmapped: true });
  });

  it("lists both live rate plans, which had no rows at all", () => {
    const rows = mappingRows(PLANS, PROVISIONED_PLANS, "rate");
    expect(rows.map((r) => r.name)).toEqual(["Standard Rate", "BB Flex", "BB Non-Refundable"]);
    expect(rows.filter((r) => r.unmapped).map((r) => r.name)).toEqual(["BB Flex", "BB Non-Refundable"]);
  });

  /*
   * ⚠️ The switched-off plan stays BECAUSE it is mapped. It is live on the channel right now, and a
   * hotel that cannot see it cannot undo it — worse than a row they no longer need.
   */
  it("keeps an inactive product that is still mapped, so it can be undone", () => {
    const rows = mappingRows(PLANS, PROVISIONED_PLANS, "rate");
    const bar = rows.find((r) => r.productId === "rp-bar")!;
    expect(bar).toMatchObject({ id: "m3", status: "complete", unmapped: false });
  });

  it("does NOT offer an inactive product that was never mapped", () => {
    // Nothing to undo and nothing to sell — offering it is a dead end, which is BUG-008's family.
    const rows = mappingRows(PLANS, [], "rate");
    expect(rows.some((r) => r.productId === "rp-bar")).toBe(false);
    expect(rows.map((r) => r.name)).toEqual(["BB Flex", "BB Non-Refundable"]);
  });
});

describe("what is mappable at all", () => {
  it("never offers a derived rate plan — it follows its parent", () => {
    const withDerived: MappableProduct[] = [
      ...PLANS,
      { id: "rp-nr", name: "Non-Refundable", active: true, priceLogic: "derived" },
    ];
    expect(mappingRows(withDerived, [], "rate").some((r) => r.productId === "rp-nr")).toBe(false);
  });

  it("does not apply the manual rule to room types, which have no price logic", () => {
    // A room type carries no `priceLogic`; filtering rooms by it would empty the table.
    expect(mappingRows(ROOMS, [], "room")).toHaveLength(3);
  });

  it("keeps the products in the order they were given", () => {
    // Sort order comes from the query. A table that reshuffles between loads is one people misread.
    expect(mappingRows(ROOMS, PROVISIONED_ROOMS, "room").map((r) => r.name)).toEqual(ROOMS.map((r) => r.name));
  });
});

describe("the attention count", () => {
  it("counts everything that cannot reach the channel, sent or not", () => {
    /*
     * The count used to be computed over mapping ROWS, so a product with no row at all — the exact
     * case here — made the number zero and the pill green. Absence and incompleteness are different
     * questions and both belong in this number.
     */
    const rows = mappingRows(PLANS, PROVISIONED_PLANS, "rate");
    expect(unmappedCount(rows)).toBe(2);
  });

  it("is zero only when every listed product is complete", () => {
    const allMapped: ExistingMapping[] = [
      { id: "a", productId: "rt-apa", externalId: "x", status: "complete" },
      { id: "b", productId: "rt-apa2", externalId: "y", status: "complete" },
      { id: "c", productId: "rt-1br", externalId: "z", status: "complete" },
    ];
    expect(unmappedCount(mappingRows(ROOMS, allMapped, "room"))).toBe(0);
  });

  it("counts a row that exists but carries no external id", () => {
    // "incomplete" — provisioning made the row and the channel never returned an id for it.
    const half: ExistingMapping[] = [{ id: "a", productId: "rt-apa", externalId: null, status: "incomplete" }];
    expect(unmappedCount(mappingRows(ROOMS, half, "room"))).toBe(3);
  });
});

describe("a hotel with nothing set up yet", () => {
  it("lists every sellable product as never sent rather than showing an empty table", () => {
    // An empty Mapping screen reads as "nothing to do here", which is the opposite of the truth.
    const rows = mappingRows(ROOMS, [], "room");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.status === "never_sent")).toBe(true);
  });

  it("returns nothing when the hotel genuinely has no products", () => {
    expect(mappingRows([], [], "room")).toEqual([]);
    expect(unmappedCount([])).toBe(0);
  });
});
