import { describe, expect, it } from "vitest";
import { planUnits, roomTypeRemoval, sameRoomLabel } from "./room-rules.js";

describe("roomTypeRemoval", () => {
  it("deletes a room type nothing depends on", () => {
    expect(roomTypeRemoval({ mapped: 0, reservations: 0, units: 0 })).toBe("delete");
  });

  it("never deletes one with physical rooms behind it — that would wipe them out of RevioPMS", () => {
    expect(roomTypeRemoval({ mapped: 0, reservations: 0, units: 3 })).toBe("deactivate");
  });

  it("keeps booking history", () => {
    expect(roomTypeRemoval({ mapped: 0, reservations: 1, units: 0 })).toBe("deactivate");
  });

  it("asks for unmapping first while a channel sells it", () => {
    expect(roomTypeRemoval({ mapped: 1, reservations: 5, units: 5 })).toBe("blocked_mapped");
  });
});

describe("planUnits", () => {
  const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => String(from + i));

  it("creates a floor that fits", () => {
    expect(planUnits({ wanted: range(101, 10), taken: [], totalRooms: 10, unitsOfType: 0 })).toEqual({
      ok: true, create: range(101, 10), skipped: [],
    });
  });

  it("skips numbers already at the property, under any type, so running it twice is safe", () => {
    const plan = planUnits({ wanted: range(101, 3), taken: ["101", " 102 "], totalRooms: 10, unitsOfType: 2 });
    expect(plan).toEqual({ ok: true, create: ["103"], skipped: ["101", "102"] });
  });

  it("says so when every number exists", () => {
    expect(planUnits({ wanted: ["101"], taken: ["101"], totalRooms: 10, unitsOfType: 1 })).toEqual({
      ok: false, reason: "all_exist", skipped: ["101"],
    });
  });

  it("refuses the whole run over the room type's count, and says how many still fit", () => {
    // The walk that found this: 50 doors under a type every channel sells as 10.
    expect(planUnits({ wanted: range(101, 50), taken: [], totalRooms: 10, unitsOfType: 0 })).toEqual({
      ok: false, reason: "over_capacity", left: 10, skipped: [],
    });
    expect(planUnits({ wanted: range(111, 3), taken: range(101, 9), totalRooms: 10, unitsOfType: 9 })).toMatchObject({
      ok: false, reason: "over_capacity", left: 1,
    });
  });

  it("never reports a negative room left when a type is already over its count", () => {
    expect(planUnits({ wanted: ["999"], taken: [], totalRooms: 10, unitsOfType: 21 })).toMatchObject({ left: 0 });
  });

  it("does not create one number twice from a single request", () => {
    expect(planUnits({ wanted: ["7", "7 "], taken: [], totalRooms: 5, unitsOfType: 0 })).toEqual({
      ok: true, create: ["7"], skipped: ["7"],
    });
  });

  it("ignores blank labels", () => {
    expect(planUnits({ wanted: ["", "  "], taken: [], totalRooms: 5, unitsOfType: 0 })).toMatchObject({ ok: false, reason: "all_exist" });
  });

  it("compares numbers the way a person reads them", () => {
    expect(sameRoomLabel("Sea View 2", "sea view 2 ")).toBe(true);
    expect(sameRoomLabel("101", "1010")).toBe(false);
  });
});
