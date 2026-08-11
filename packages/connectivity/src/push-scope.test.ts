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

/**
 * The availability fallback exists so a date the hotel never priced still reports its room count —
 * otherwise a booking on such a date would leave the channel selling a room that is gone.
 *
 * It has to respect the scope, and once did not. A two-room availability edit (Twin over one week,
 * Double over the next) then produced four assertions instead of two: each room's real change, plus
 * each room's *unchanged* count restated across the other room's dates. Values nobody edited, on
 * dates nobody touched — which is exactly what Channex's "only send changes" rule forbids, and what
 * certification test 10 caught.
 */
describe("availability fallback", () => {
  /** Mirrors the emit decision in syncChannel for one (room, date). */
  const wouldEmitFallback = (opts: { inScopeHere: boolean; priced: boolean; wantsAvailability: boolean }) =>
    !opts.priced && opts.inScopeHere && opts.wantsAvailability;

  it("fires for an in-scope date the hotel never priced", () => {
    expect(wouldEmitFallback({ inScopeHere: true, priced: false, wantsAvailability: true })).toBe(true);
  });

  it("stays silent for a date the scope excluded", () => {
    expect(wouldEmitFallback({ inScopeHere: false, priced: false, wantsAvailability: true })).toBe(false);
  });

  it("stays silent when the rate loop already emitted the row", () => {
    expect(wouldEmitFallback({ inScopeHere: true, priced: true, wantsAvailability: true })).toBe(false);
  });

  it("stays silent on a push that is not carrying availability at all", () => {
    expect(wouldEmitFallback({ inScopeHere: true, priced: false, wantsAvailability: false })).toBe(false);
  });
});
