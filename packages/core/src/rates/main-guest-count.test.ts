import { describe, it, expect } from "vitest";
import {
  resolveMainGuestCount, describeMainGuestCount, MAX_MAIN_GUESTS, type RoomOccupancyFacts,
} from "./main-guest-count.js";

/** A room, described the way the rates screens already hold one. */
const room = (
  defaultOccupancy: number | null, totalRooms: number, maxGuests = 4,
): RoomOccupancyFacts => ({ defaultOccupancy, totalRooms, maxGuests });

describe("a configured value is a decision and always wins", () => {
  it("uses what somebody chose, over anything the rooms say", () => {
    const m = resolveMainGuestCount(3, [room(2, 40)]);
    expect(m).toMatchObject({ value: 3, basis: "configured" });
  });

  it("carries no note — a decision needs no caveat beside it", () => {
    expect(resolveMainGuestCount(2, []).note).toBeNull();
  });

  it("clamps to the ceiling Channex will carry", () => {
    expect(resolveMainGuestCount(999, []).value).toBe(MAX_MAIN_GUESTS);
  });

  it("treats a nonsense configured value as unset rather than obeying it", () => {
    // 0, negatives and NaN are not choices; falling through to the rooms beats anchoring on zero.
    for (const bad of [0, -3, Number.NaN]) {
      expect(resolveMainGuestCount(bad, [room(2, 10)])).toMatchObject({ value: 2, basis: "derived" });
    }
  });

  it("reads unset as unset, both ways of spelling it", () => {
    expect(resolveMainGuestCount(null, [room(2, 10)]).basis).toBe("derived");
    expect(resolveMainGuestCount(undefined, [room(2, 10)]).basis).toBe("derived");
  });
});

describe("derivation describes the property's typical sale, not its first row", () => {
  it("anchors on the most common room, weighted by how many exist", () => {
    // The headline case: forty doubles and one single anchors on two.
    const m = resolveMainGuestCount(null, [room(2, 40), room(1, 1)]);
    expect(m).toMatchObject({ value: 2, basis: "derived" });
  });

  it("THE BUG: the first room in the list no longer decides", () => {
    // This is what `roomTypes[0]?.defaultOccupancy ?? 2` did. A property whose first room happens
    // to be a single was told its main guest count was 1, on a hotel of forty doubles.
    const rooms = [room(1, 1), room(2, 40)];
    expect(rooms[0]!.defaultOccupancy).toBe(1);
    expect(resolveMainGuestCount(null, rooms).value).toBe(2);
  });

  it("falls back to the room's ceiling when it has no standard occupancy", () => {
    expect(resolveMainGuestCount(null, [room(null, 5, 3)])).toMatchObject({ value: 3, basis: "derived" });
  });

  it("counts a room type that exists even when totalRooms is zero or unset", () => {
    // Weight floors at 1: a room nobody has counted yet is still a room being sold.
    expect(resolveMainGuestCount(null, [room(2, 0)]).value).toBe(2);
  });

  it("breaks a tie toward the smaller occupancy", () => {
    // Under-anchoring makes the ladder ADD money, which is visible and easy to correct.
    // Over-anchoring makes it subtract, which quietly undersells every booking.
    expect(resolveMainGuestCount(null, [room(2, 10), room(4, 10)]).value).toBe(2);
  });

  it("ignores rooms whose occupancy is unusable rather than counting them as one", () => {
    const m = resolveMainGuestCount(null, [room(0, 99), room(3, 2)]);
    expect(m).toMatchObject({ value: 3, basis: "derived" });
  });

  it("says out loud that nobody set it", () => {
    expect(resolveMainGuestCount(null, [room(2, 4)]).note).toMatch(/nobody has set this/i);
  });
});

describe("with nothing to work from it assumes, and admits it", () => {
  it("falls back to two", () => {
    expect(resolveMainGuestCount(null, [])).toMatchObject({ value: 2, basis: "fallback" });
  });

  it("falls back when every room is unusable, not just when there are none", () => {
    expect(resolveMainGuestCount(null, [room(0, 1, 0)]).basis).toBe("fallback");
  });

  it("names the assumption", () => {
    expect(resolveMainGuestCount(null, []).note).toMatch(/assuming 2/i);
  });
});

describe("the label never lets an assumption read as a decision", () => {
  it("claims the number only when it was chosen", () => {
    expect(describeMainGuestCount(resolveMainGuestCount(2, []))).toBe("2 guests — your main guest count");
  });

  it("marks a derived or fallback number as assumed", () => {
    expect(describeMainGuestCount(resolveMainGuestCount(null, [room(2, 4)]))).toBe("2 guests — assumed");
    expect(describeMainGuestCount(resolveMainGuestCount(null, []))).toBe("2 guests — assumed");
  });

  it("counts one guest in the singular", () => {
    expect(describeMainGuestCount(resolveMainGuestCount(1, []))).toBe("1 guest — your main guest count");
  });
});
