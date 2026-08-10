import { describe, it, expect } from "vitest";
import type { PushScope } from "./sync.js";

/**
 * The cell filter inside `syncChannel`, isolated.
 *
 * `dates`, `roomTypeIds` and `ratePlanIds` are independent axes, so together they describe a CROSS
 * PRODUCT. One change really did edit every combination of its own axes, so that was harmless — up
 * to the moment several changes started travelling in one push. Setting the Twin rate on the 21st
 * and the Double rate on the 25th would then also restate the Twin on the 25th and the Double on
 * the 21st: values nobody edited, on dates nobody asked about. Channex reads every field in a
 * payload as an instruction, so those are four wrong instructions, not four redundant ones.
 */
function makeInScope(scope: PushScope) {
  const exact = scope.cells
    ? new Set(scope.cells.filter((c) => c.ratePlanId).map((c) => `${c.roomTypeId}|${c.ratePlanId}|${c.date}`))
    : null;
  const anyPlan = scope.cells
    ? new Set(scope.cells.filter((c) => !c.ratePlanId).map((c) => `${c.roomTypeId}|${c.date}`))
    : null;
  return (roomTypeId: string, ratePlanId: string, date: string) =>
    exact == null || exact.has(`${roomTypeId}|${ratePlanId}|${date}`) || anyPlan!.has(`${roomTypeId}|${date}`);
}

describe("cell-level push scope", () => {
  it("sends everything when no cells are given — an unscoped push is still a full push", () => {
    const inScope = makeInScope({ dates: ["2026-11-21"], roomTypeIds: ["twin"] });
    expect(inScope("twin", "twin-bar", "2026-11-21")).toBe(true);
    expect(inScope("dbl", "dbl-bnb", "2027-04-02")).toBe(true);
  });

  it("keeps two batched rate changes off each other's dates", () => {
    // "Twin BAR on the 21st, Double BAR on the 25th" — the exact shape of certification test 3.
    const inScope = makeInScope({
      cells: [
        { roomTypeId: "twin", ratePlanId: "twin-bar", date: "2026-11-21" },
        { roomTypeId: "dbl", ratePlanId: "dbl-bar", date: "2026-11-25" },
      ],
    });
    expect(inScope("twin", "twin-bar", "2026-11-21")).toBe(true);
    expect(inScope("dbl", "dbl-bar", "2026-11-25")).toBe(true);
    // The cross product the axes alone would have produced:
    expect(inScope("twin", "twin-bar", "2026-11-25")).toBe(false);
    expect(inScope("dbl", "dbl-bar", "2026-11-21")).toBe(false);
  });

  it("leaves a sibling rate plan alone on a rate change", () => {
    const inScope = makeInScope({ cells: [{ roomTypeId: "twin", ratePlanId: "twin-bar", date: "2026-11-22" }] });
    expect(inScope("twin", "twin-bar", "2026-11-22")).toBe(true);
    expect(inScope("twin", "twin-bnb", "2026-11-22")).toBe(false);
  });

  it("covers every rate plan of the room when a cell names no plan", () => {
    // Restrictions are stored per room type, so a min-stay edit genuinely applies to both plans.
    const inScope = makeInScope({ cells: [{ roomTypeId: "twin", date: "2026-11-23" }] });
    expect(inScope("twin", "twin-bar", "2026-11-23")).toBe(true);
    expect(inScope("twin", "twin-bnb", "2026-11-23")).toBe(true);
    expect(inScope("dbl", "dbl-bar", "2026-11-23")).toBe(false);
    expect(inScope("twin", "twin-bar", "2026-11-24")).toBe(false);
  });

  it("mixes plan-scoped and room-scoped cells in one batch", () => {
    const inScope = makeInScope({
      cells: [
        { roomTypeId: "twin", ratePlanId: "twin-bar", date: "2026-12-01" }, // a price
        { roomTypeId: "dbl", date: "2026-12-05" },                          // a restriction
      ],
    });
    expect(inScope("twin", "twin-bar", "2026-12-01")).toBe(true);
    expect(inScope("twin", "twin-bnb", "2026-12-01")).toBe(false);
    expect(inScope("dbl", "dbl-bar", "2026-12-05")).toBe(true);
    expect(inScope("dbl", "dbl-bnb", "2026-12-05")).toBe(true);
  });

  it("sends nothing for an empty cell list rather than falling back to everything", () => {
    const inScope = makeInScope({ cells: [] });
    expect(inScope("twin", "twin-bar", "2026-11-21")).toBe(false);
  });
});
