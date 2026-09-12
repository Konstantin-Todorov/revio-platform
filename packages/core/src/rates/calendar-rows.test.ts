import { describe, expect, it } from "vitest";
import { ratePlanIdsToLoad, ratePlanRows, type RatePlanRowInput } from "./calendar-rows.js";

/**
 * Reported from a real hotel on 2026-09-12 as fourteen bugs across two products. Most of them were
 * this one rule being absent, so the configuration that produced them is the fixture.
 *
 * Cabacum Beach Residence: three manual plans, the legacy `BAR` switched OFF, two `BB` plans live.
 */
const CABACUM: RatePlanRowInput[] = [
  { id: "p-bar", code: "BAR", name: "Standard Rate", active: false, priceLogic: "manual", sortOrder: 0, parentRatePlanId: null },
  { id: "p-bb48", code: "BB48", name: "BB Flex", active: true, priceLogic: "manual", sortOrder: 1, parentRatePlanId: null },
  { id: "p-bbnr", code: "BBNR", name: "BB Non-Refundable", active: true, priceLogic: "manual", sortOrder: 2, parentRatePlanId: null },
];

describe("what the calendar shows", () => {
  it("renders a row for EVERY active plan, not one", () => {
    // BUG-001/003/005: every read surface rendered exactly one plan. No read surface had ever
    // rendered two, which is why nothing named the row it did render.
    const { rows } = ratePlanRows(CABACUM);
    expect(rows.map((r) => r.code)).toEqual(["BB48", "BBNR"]);
  });

  it("never renders or offers an inactive plan", () => {
    /*
     * BUG-005/008/011. RevioLink's calendar showed *Standard Rate* — switched off in Rooms & Rates —
     * and hid both plans the hotel was actually selling. Bulk Update then offered the same dead plan
     * and rejected it on apply with an accurate message nobody should ever have had to read.
     */
    const { rows, options } = ratePlanRows(CABACUM);
    expect(rows.some((r) => r.code === "BAR")).toBe(false);
    expect(options.some((o) => o.value === "BAR")).toBe(false);
  });

  it("labels every row with the plan's own name", () => {
    // BUG-001: one row titled "Rate", with two plans configured and nothing saying which.
    expect(ratePlanRows(CABACUM).rows.map((r) => r.label)).toEqual(["BB Flex", "BB Non-Refundable"]);
    expect(ratePlanRows(CABACUM).rows.some((r) => r.label === "Rate")).toBe(false);
  });

  it("orders by sort order so the grid does not reshuffle between loads", () => {
    const shuffled = [CABACUM[2]!, CABACUM[0]!, CABACUM[1]!];
    expect(ratePlanRows(shuffled).rows.map((r) => r.code)).toEqual(["BB48", "BBNR"]);
  });
});

describe("the filter, and the three numbers that disagreed", () => {
  /*
   * BUG-002/006. RevioLink defaulted the selection to the hardcoded demo codes ["BAR","NR","BRF"],
   * so the pill counted 3, the list offered the hotel's 2 active plans, and neither was ticked.
   */
  it("reconciles a stale selection instead of rendering an empty grid", () => {
    const r = ratePlanRows(CABACUM, ["BAR", "NR", "BRF"]);
    expect(r.selectionIgnored).toBe(true);
    expect(r.rows.map((r2) => r2.code)).toEqual(["BB48", "BBNR"]);
  });

  it("keeps the pill, the options and the rows counting the same thing", () => {
    // Whatever is selected, these three cannot disagree — they are computed from one set.
    for (const sel of [undefined, ["BB48"], ["BB48", "BBNR"], ["BAR", "NR", "BRF"], []]) {
      const r = ratePlanRows(CABACUM, sel);
      expect(r.selected.length, JSON.stringify(sel)).toBe(r.rows.length);
      for (const code of r.selected) {
        expect(r.options.some((o) => o.value === code), code).toBe(true);
      }
    }
  });

  it("actually filters when the selection names a live plan", () => {
    // BUG-002: the control updated its own label and the grid never changed.
    const r = ratePlanRows(CABACUM, ["BBNR"]);
    expect(r.rows.map((x) => x.code)).toEqual(["BBNR"]);
    expect(r.selectionIgnored).toBe(false);
  });

  it("drops an inactive plan from a selection without falling back to everything", () => {
    const r = ratePlanRows(CABACUM, ["BAR", "BBNR"]);
    expect(r.rows.map((x) => x.code)).toEqual(["BBNR"]);
    expect(r.selectionIgnored).toBe(false);
  });
});

describe("which prices have to be loaded", () => {
  const WITH_DERIVED: RatePlanRowInput[] = [
    ...CABACUM,
    { id: "p-nr", code: "NR", name: "Non-Refundable", active: true, priceLogic: "derived", sortOrder: 3, parentRatePlanId: "p-bb48" },
  ];

  it("loads the parent of a derived row, even when the parent is not on screen", () => {
    // Otherwise a derived row renders "—" while its parent has a perfectly good price.
    const { rows } = ratePlanRows(WITH_DERIVED, ["NR"]);
    expect(ratePlanIdsToLoad(rows, WITH_DERIVED).sort()).toEqual(["p-bb48", "p-nr"]);
  });

  it("follows a chain of parents", () => {
    const chain: RatePlanRowInput[] = [
      ...WITH_DERIVED,
      { id: "p-x", code: "X", name: "X", active: true, priceLogic: "derived", sortOrder: 4, parentRatePlanId: "p-nr" },
    ];
    expect(ratePlanIdsToLoad(ratePlanRows(chain, ["X"]).rows, chain).sort()).toEqual(["p-bb48", "p-nr", "p-x"]);
  });

  it("terminates on a cycle rather than hanging the calendar", () => {
    // Nothing should be able to create one, but a calendar that never returns is worse than a wrong row.
    const cyclic: RatePlanRowInput[] = [
      { id: "a", code: "A", name: "A", active: true, priceLogic: "derived", sortOrder: 0, parentRatePlanId: "b" },
      { id: "b", code: "B", name: "B", active: true, priceLogic: "derived", sortOrder: 1, parentRatePlanId: "a" },
    ];
    expect(ratePlanIdsToLoad(ratePlanRows(cyclic).rows, cyclic).sort()).toEqual(["a", "b"]);
  });
});
