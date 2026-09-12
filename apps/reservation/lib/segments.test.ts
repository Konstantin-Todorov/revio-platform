import { describe, expect, it } from "vitest";
import { activeSegment, reservationSegments, segmentHref } from "./segments";

/**
 * The tabs above the reservation list.
 *
 * The rule they exist to obey: a tab is a SHORTCUT to the filters the page already has, never a
 * second way of asking the same question. Two definitions of "arriving today" would disagree within
 * a fortnight — and on this week's evidence, the screen would then highlight one thing and list
 * another. These tests are what stops that being possible quietly.
 */

const TODAY = "2026-09-12";

describe("what each tab asks for", () => {
  it("asks in the page's own filter vocabulary, so the same query answers it", () => {
    const byKey = Object.fromEntries(reservationSegments(TODAY).map((s) => [s.key, s.params]));
    expect(byKey.arriving).toEqual({ dateType: "check_in", from: TODAY, to: TODAY });
    expect(byKey.inhouse).toEqual({ dateType: "stay", from: TODAY, to: TODAY });
    expect(byKey.departing).toEqual({ dateType: "check_out", from: TODAY, to: TODAY });
    expect(byKey.cancelled).toEqual({ dateType: "cancelled", from: TODAY, to: TODAY });
  });

  it("uses the stay overlap for in-house, not the check-in date", () => {
    /*
     * A guest who arrived on Tuesday is in house on Thursday. `check_in` would miss them entirely —
     * the single most likely way to get this tab wrong, and it would look plausible every Monday.
     */
    expect(reservationSegments(TODAY).find((s) => s.key === "inhouse")!.params.dateType).toBe("stay");
  });

  it("leaves 'All' unfiltered rather than describing a range that means everything", () => {
    expect(reservationSegments(TODAY).find((s) => s.key === "all")!.params).toEqual({});
    expect(segmentHref(reservationSegments(TODAY)[0]!)).toBe("/reservations");
  });

  it("builds a link that carries only its own question", () => {
    const arriving = reservationSegments(TODAY).find((s) => s.key === "arriving")!;
    expect(segmentHref(arriving)).toBe("/reservations?dateType=check_in&from=2026-09-12&to=2026-09-12");
  });
});

describe("which tab is lit", () => {
  it("lights the tab whose filters are actually applied", () => {
    for (const seg of reservationSegments(TODAY)) {
      expect(activeSegment(seg.params, TODAY), seg.key).toBe(seg.key);
    }
  });

  /*
   * ⚠️ Derived from the params, never stored. A remembered "current tab" is a second source of truth,
   * and the failure it produces is a screen highlighting "Arriving today" while listing last month.
   */
  it("lights nothing when the filters describe something no tab does", () => {
    expect(activeSegment({ dateType: "check_in", from: "2026-08-01", to: "2026-08-31" }, TODAY)).toBeNull();
    expect(activeSegment({ dateType: "created", from: TODAY, to: TODAY }, TODAY)).toBeNull();
  });

  it("lights nothing once a search or a status narrows it further", () => {
    // The list is then a subset of the tab, so highlighting the tab would overstate what is shown.
    expect(activeSegment({ dateType: "check_in", from: TODAY, to: TODAY, q: "petrov" }, TODAY)).toBeNull();
    expect(activeSegment({ dateType: "check_in", from: TODAY, to: TODAY, status: "cancelled" }, TODAY)).toBeNull();
  });

  it("lights 'All' only when nothing at all is filtering", () => {
    expect(activeSegment({}, TODAY)).toBe("all");
    expect(activeSegment({ from: TODAY }, TODAY)).toBeNull();
  });

  it("stops lighting yesterday's tab when the date rolls over", () => {
    // The params are pinned to a date. Left open overnight, a tab must not claim to be today's.
    const yesterday = { dateType: "check_in", from: "2026-09-11", to: "2026-09-11" };
    expect(activeSegment(yesterday, "2026-09-11")).toBe("arriving");
    expect(activeSegment(yesterday, TODAY)).toBeNull();
  });
});
