import { describe, it, expect } from "vitest";
import { rankUnitsForStay, suggestAssignment, canReassign, type AssignmentCandidate, type AssignmentContext } from "./assignment.js";

const unit = (over: Partial<AssignmentCandidate> = {}): AssignmentCandidate => ({
  unitId: over.label ?? "u1",
  label: "101",
  floor: "1",
  hkStatus: "clean",
  roomTypeId: "double",
  freeWholeStay: true,
  freeSomeNights: false,
  blocked: false,
  ...over,
});

const ctx = (over: Partial<AssignmentContext> = {}): AssignmentContext => ({
  bookedRoomTypeId: "double",
  sameDayArrival: false,
  preferredFloor: null,
  turnoversByFloor: {},
  staffedFloors: [],
  occupiedByFloor: {},
  ...over,
});

describe("rankUnitsForStay — what is not a choice at all", () => {
  it("drops a room of the wrong type — an upgrade is a human decision", () => {
    const out = rankUnitsForStay([unit({ label: "101", roomTypeId: "suite" })], ctx());
    expect(out).toHaveLength(0);
  });

  it("drops a blocked room", () => {
    expect(rankUnitsForStay([unit({ blocked: true })], ctx())).toHaveLength(0);
  });

  it("drops a room free for only part of the stay — no forced mid-stay move", () => {
    const out = rankUnitsForStay([unit({ freeWholeStay: false, freeSomeNights: true })], ctx());
    expect(out).toHaveLength(0);
  });

  it("returns nothing rather than something wrong when the type is sold out", () => {
    expect(suggestAssignment([unit({ blocked: true })], ctx())).toBeNull();
  });
});

describe("rankUnitsForStay — the guest outranks the operation", () => {
  it("puts a returning guest on their usual floor even when it costs housekeeping", () => {
    const preferred = unit({ label: "301", floor: "3", hkStatus: "dirty" });
    const efficient = unit({ label: "101", floor: "1", hkStatus: "clean" });
    const out = rankUnitsForStay([efficient, preferred], ctx({
      preferredFloor: "3",
      sameDayArrival: true,
      turnoversByFloor: { "1": 3 },
    }));
    expect(out[0]!.label).toBe("301");
    expect(out[0]!.reasons).toContain("guest's usual floor");
  });

  it("ignores a floor preference that was never passed — the n>=2 rule is the caller's", () => {
    const out = rankUnitsForStay([unit({ label: "301", floor: "3" }), unit({ label: "101", floor: "1" })], ctx());
    expect(out[0]!.reasons).not.toContain("guest's usual floor");
  });
});

describe("rankUnitsForStay — housekeeping cost", () => {
  it("prefers a ready room for a same-day arrival", () => {
    const out = rankUnitsForStay([
      unit({ label: "101", hkStatus: "dirty" }),
      unit({ label: "102", hkStatus: "inspected" }),
    ], ctx({ sameDayArrival: true }));
    expect(out[0]!.label).toBe("102");
    expect(out[0]!.reasons).toContain("ready now, no turn needed today");
  });

  it("cares far less about readiness for an arrival days away", () => {
    // A dirty room next Tuesday is not a problem, so cleanliness must not outweigh clustering.
    const dirtyClustered = unit({ label: "201", floor: "2", hkStatus: "dirty" });
    const cleanAlone = unit({ label: "901", floor: "9", hkStatus: "clean" });
    const out = rankUnitsForStay([cleanAlone, dirtyClustered], ctx({
      sameDayArrival: false,
      turnoversByFloor: { "2": 3 },
    }));
    expect(out[0]!.label).toBe("201");
  });

  it("clusters turnovers onto the floor already being worked", () => {
    const out = rankUnitsForStay([
      unit({ label: "501", floor: "5" }),
      unit({ label: "205", floor: "2" }),
    ], ctx({ turnoversByFloor: { "2": 2 } }));
    expect(out[0]!.label).toBe("205");
    expect(out[0]!.reasons.some((r) => r.includes("clusters with"))).toBe(true);
  });

  it("concentrates occupancy so empty zones stay empty", () => {
    const out = rankUnitsForStay([
      unit({ label: "701", floor: "7" }),
      unit({ label: "203", floor: "2" }),
    ], ctx({ occupiedByFloor: { "2": 3 } }));
    expect(out[0]!.label).toBe("203");
    expect(out[0]!.reasons).toContain("keeps occupancy together");
  });

  it("avoids a floor nobody is clocked in on", () => {
    const out = rankUnitsForStay([
      unit({ label: "801", floor: "8" }),
      unit({ label: "102", floor: "1" }),
    ], ctx({ staffedFloors: ["1"] }));
    expect(out[0]!.label).toBe("102");
    expect(out[0]!.reasons).toContain("floor is staffed today");
    expect(out[1]!.reasons).toContain("no one clocked in on this floor");
  });

  it("skips load levelling entirely when nobody has clocked in", () => {
    const out = rankUnitsForStay([unit({ label: "801", floor: "8" })], ctx({ staffedFloors: [] }));
    expect(out[0]!.reasons).not.toContain("no one clocked in on this floor");
  });
});

describe("rankUnitsForStay — tie-breaks and honesty", () => {
  it("leaves the low contiguous block free for walk-ins and groups", () => {
    const out = rankUnitsForStay([unit({ label: "101" }), unit({ label: "108" })], ctx());
    expect(out[0]!.label).toBe("108");
  });

  it("says 'next available room' rather than inventing a reason", () => {
    const out = rankUnitsForStay([unit({ label: "101" })], ctx());
    expect(out[0]!.reasons).toEqual(["next available room"]);
  });

  it("is deterministic when two rooms score identically", () => {
    const a = rankUnitsForStay([unit({ label: "205", floor: "2" }), unit({ label: "204", floor: "2" })], ctx());
    const b = rankUnitsForStay([unit({ label: "204", floor: "2" }), unit({ label: "205", floor: "2" })], ctx());
    expect(a.map((x) => x.label)).toEqual(b.map((x) => x.label));
  });
});

describe("canReassign — a human's choice is final", () => {
  it("may re-optimise an auto assignment before arrival", () => {
    expect(canReassign({ pinned: false, checkedInAt: null })).toBe(true);
  });

  it("never touches a pinned assignment", () => {
    // The whole promise of manual override: nobody is surprised the night before arrival.
    expect(canReassign({ pinned: true, checkedInAt: null })).toBe(false);
  });

  it("never moves a guest who is already in the room", () => {
    expect(canReassign({ pinned: false, checkedInAt: new Date("2026-08-23T14:00:00Z") })).toBe(false);
  });
});
