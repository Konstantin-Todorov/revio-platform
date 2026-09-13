import { describe, it, expect } from "vitest";
import {
  invertSelection, isRectangular, matchesSearch, pairKey, roomCheckState, selectAll,
  selectablePlans, selectedPairs, selectionCount, selectionSummary, toggleRoom, togglePlan,
  type SelectableRoom,
} from "./plan-selection.js";

const plan = (id: string, name: string, over = {}) =>
  ({ id, name, active: true, priceLogic: "manual", ...over });

const ROOMS: SelectableRoom[] = [
  { id: "r1", name: "Apartment, 1 Bedroom", code: "1BR", plans: [
    plan("flex", "BB Flex", { code: "BB48" }),
    plan("nr", "BB Non-Refundable", { code: "BBNR" }),
    plan("std", "Standard Rate", { code: "BAR", active: false }),
    plan("mob", "BB Mobile", { priceLogic: "derived", parentName: "BB Flex" }),
  ] },
  { id: "r2", name: "Apartment, 2 Bedrooms", code: "APA2", plans: [
    plan("flex", "BB Flex"), plan("nr", "BB Non-Refundable"),
  ] },
];

describe("selectablePlans", () => {
  it("⚠️ shows inactive and derived plans but never lets them be picked", () => {
    // A plan you cannot see is a plan you cannot reason about (§5.3 rules 3 and 4): the hotel needs
    // to know BB Mobile follows BB Flex and Standard Rate is off, or "apply to the whole room" is a
    // promise whose scope nobody can check.
    expect(ROOMS[0]!.plans).toHaveLength(4);
    expect(selectablePlans(ROOMS[0]!).map((p) => p.id)).toEqual(["flex", "nr"]);
  });
});

describe("roomCheckState", () => {
  it("is unchecked, indeterminate and checked as plans are picked", () => {
    expect(roomCheckState(ROOMS[0]!, new Set())).toBe("unchecked");
    expect(roomCheckState(ROOMS[0]!, new Set([pairKey("r1", "flex")]))).toBe("indeterminate");
    expect(roomCheckState(ROOMS[0]!, new Set([pairKey("r1", "flex"), pairKey("r1", "nr")]))).toBe("checked");
  });

  it("⚠️ a room whose only plans are derived or inactive is never 'checked'", () => {
    // Otherwise the room reads as fully selected while contributing nothing to the edit.
    const empty: SelectableRoom = { id: "r9", name: "Villa", plans: [plan("d", "D", { priceLogic: "derived" })] };
    expect(roomCheckState(empty, selectAll([empty]))).toBe("unchecked");
  });
});

describe("toggleRoom", () => {
  it("⚠️ an indeterminate room fills up rather than clearing", () => {
    // Somebody who picked one of two and clicks the room is ADDING the rest. Clearing their work is
    // the one outcome they certainly did not intend.
    const partial = new Set([pairKey("r1", "flex")]);
    expect(roomCheckState(ROOMS[0]!, toggleRoom(ROOMS[0]!, partial))).toBe("checked");
  });

  it("a fully checked room clears", () => {
    const all = toggleRoom(ROOMS[0]!, new Set());
    expect(roomCheckState(ROOMS[0]!, toggleRoom(ROOMS[0]!, all))).toBe("unchecked");
  });

  it("never selects a derived or inactive plan", () => {
    const all = toggleRoom(ROOMS[0]!, new Set());
    expect(all.has(pairKey("r1", "mob"))).toBe(false);
    expect(all.has(pairKey("r1", "std"))).toBe(false);
  });

  it("touches only its own room", () => {
    const s = toggleRoom(ROOMS[0]!, new Set());
    expect(s.has(pairKey("r2", "flex"))).toBe(false);
  });
});

describe("togglePlan", () => {
  it("⚠️ the same plan on two rooms is two independent choices", () => {
    // The whole point of pairs. BB Flex on the 1-Bedroom and BB Flex on the 2-Bedroom are different
    // things to Channex and must be different things here.
    let s = togglePlan(ROOMS[0]!, "flex", new Set());
    expect(s.has(pairKey("r1", "flex"))).toBe(true);
    expect(s.has(pairKey("r2", "flex"))).toBe(false);
    s = togglePlan(ROOMS[1]!, "flex", s);
    expect(s.has(pairKey("r2", "flex"))).toBe(true);
  });

  it("refuses a derived or inactive plan rather than silently accepting the click", () => {
    expect(togglePlan(ROOMS[0]!, "mob", new Set()).size).toBe(0);
    expect(togglePlan(ROOMS[0]!, "std", new Set()).size).toBe(0);
  });
});

describe("isRectangular", () => {
  it("⚠️ THE TRAP — a diagonal selection cannot be written as two lists", () => {
    /*
     * 1-Bedroom · BB Flex and 2-Bedroom · BB NR. Flattened to rooms × plans that becomes FOUR
     * pairs, applying the edit to two combinations nobody chose, at whatever price was typed.
     *
     * The old two-block selector could only ever express a rectangle, which is why this has to be
     * checked before the legacy payload is used.
     */
    expect(isRectangular([
      { roomTypeId: "r1", ratePlanId: "flex" },
      { roomTypeId: "r2", ratePlanId: "nr" },
    ])).toBe(false);
  });

  it("says yes for a genuine rectangle", () => {
    expect(isRectangular([
      { roomTypeId: "r1", ratePlanId: "flex" }, { roomTypeId: "r1", ratePlanId: "nr" },
      { roomTypeId: "r2", ratePlanId: "flex" }, { roomTypeId: "r2", ratePlanId: "nr" },
    ])).toBe(true);
  });

  it("one pair and no pairs are both rectangles", () => {
    expect(isRectangular([])).toBe(true);
    expect(isRectangular([{ roomTypeId: "r1", ratePlanId: "flex" }])).toBe(true);
  });
});

describe("selectedPairs and the summary", () => {
  it("returns the pairs themselves — the only lossless form", () => {
    const s = new Set([pairKey("r1", "flex"), pairKey("r2", "nr")]);
    expect(selectedPairs(ROOMS, s)).toEqual([
      { roomTypeId: "r1", ratePlanId: "flex" },
      { roomTypeId: "r2", ratePlanId: "nr" },
    ]);
  });

  it("groups by room with plan NAMES — the thing the old screen could not do", () => {
    const groups = selectionSummary(ROOMS, new Set([pairKey("r1", "flex"), pairKey("r1", "nr"), pairKey("r2", "flex")]));
    expect(groups).toHaveLength(2);
    expect(groups[0]!.roomTypeName).toBe("Apartment, 1 Bedroom");
    expect(groups[0]!.plans.map((p) => p.name)).toEqual(["BB Flex", "BB Non-Refundable"]);
  });

  it("counts in words a person can check against what they meant", () => {
    expect(selectionCount([])).toBe("Nothing selected");
    expect(selectionCount(selectionSummary(ROOMS, new Set([pairKey("r1", "flex")]))))
      .toBe("Selected 1 rate plan across 1 room type");
    expect(selectionCount(selectionSummary(ROOMS, selectAll(ROOMS))))
      .toBe("Selected 4 rate plans across 2 room types");
  });
});

describe("select all and invert", () => {
  it("selects every selectable pair and nothing else", () => {
    expect(selectAll(ROOMS).size).toBe(4);
  });

  it("inverts within the selectable set", () => {
    const s = new Set([pairKey("r1", "flex")]);
    const inv = invertSelection(ROOMS, s);
    expect(inv.has(pairKey("r1", "flex"))).toBe(false);
    expect(inv.size).toBe(3);
  });
});

describe("matchesSearch", () => {
  it("finds by plan name, plan code, room name and room code", () => {
    const r = ROOMS[0]!, p = r.plans[0]!;
    for (const q of ["flex", "BB48", "1 Bedroom", "1br"]) {
      expect(matchesSearch(r, p, q), q).toBe(true);
    }
    expect(matchesSearch(r, p, "suite")).toBe(false);
  });

  it("an empty query matches everything", () => {
    expect(matchesSearch(ROOMS[0]!, null, "  ")).toBe(true);
  });
});
