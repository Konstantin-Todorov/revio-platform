import { describe, expect, it } from "vitest";
import { PRECEDENCE_LINE, resolveMainGuestCount, selectionCount, type SelectionGroup } from "@revio/core";
import { bulk } from "./bulk";

/**
 * Sentences core writes in English, worded here so RevioCRS can say them in Bulgarian. RevioLink still
 * reads core's, so the English must stay word for word the same or the two products drift apart.
 */
describe("Bulk English matches core", () => {
  const en = bulk.en;
  it("precedence", () => expect(en.precedence).toBe(PRECEDENCE_LINE));
  it("main guest notes", () => {
    expect(en.mainGuestNote.derived).toBe(resolveMainGuestCount(null, [{ maxGuests: 2, defaultOccupancy: null, totalRooms: 3 }]).note);
    expect(en.mainGuestNote.fallback).toBe(resolveMainGuestCount(null, []).note);
  });
  it("selection count", () => {
    const g = (plans: number, roomOnly = false): SelectionGroup =>
      ({ roomTypeId: "r", roomTypeName: "R", roomOnly, plans: Array.from({ length: plans }, (_, i) => ({ id: `p${i}`, name: `P${i}` })) }) as unknown as SelectionGroup;
    for (const groups of [[], [g(1)], [g(2), g(1)], [g(0, true)], [g(3), g(0, true), g(0, true)]]) {
      const plans = groups.reduce((n, x) => n + x.plans.length, 0);
      const rooms = groups.filter((x) => x.plans.length > 0).length;
      const roomOnly = groups.filter((x) => x.roomOnly).length;
      expect(en.tree.count(plans, rooms, roomOnly)).toBe(selectionCount(groups));
    }
  });
});
