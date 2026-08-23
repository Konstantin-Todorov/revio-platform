import { describe, it, expect } from "vitest";
import { deriveStayState, canCheckIn, canCancel, type StayAssignment } from "./stay-state.js";

const live: StayAssignment = { status: "active", checkedOutAt: null };
const checkedOut: StayAssignment = { status: "active", checkedOutAt: new Date("2026-07-21T14:18:00Z") };
const moved: StayAssignment = { status: "moved", checkedOutAt: null };

/** Noon, with an 11:00 checkout — so "past the checkout time" is true unless a test says otherwise. */
const base = { today: "2026-08-23", nowMinutes: 12 * 60, checkOutMinutes: 11 * 60 };

describe("deriveStayState — occupancy", () => {
  it("a stay with a live assignment is in the house", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [live], checkOutDate: "2026-08-25" });
    expect(s.inHouse).toBe(true);
    expect(s.overdueState).toBeNull();
  });

  it("a stay with no assignments is not in the house", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [], checkOutDate: "2026-08-25" });
    expect(s.inHouse).toBe(false);
  });

  it("a checked-out assignment does not keep the stay in the house", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [checkedOut], checkOutDate: "2026-08-25" });
    expect(s.inHouse).toBe(false);
  });

  it("a superseded (moved) assignment does not count as occupancy", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [moved], checkOutDate: "2026-08-25" });
    expect(s.inHouse).toBe(false);
  });

  it("a room move — one moved, one live — is still one stay in the house", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [moved, live], checkOutDate: "2026-08-25" });
    expect(s.inHouse).toBe(true);
  });
});

describe("deriveStayState — departedAt overrides the assignment rows", () => {
  // This is the whole bug, reduced to its shape: production had exactly this row set — a departed
  // stay carrying live assignments created by a second check-in eight hours after check-out.
  const departedWithLiveRows = {
    ...base,
    departedAt: new Date("2026-07-21T14:18:00Z"),
    assignments: [checkedOut, moved, live],
    checkOutDate: "2026-07-09",
  };

  it("a departed stay is not in the house even while a live assignment exists", () => {
    expect(deriveStayState(departedWithLiveRows).inHouse).toBe(false);
  });

  it("a departed stay can never overstay, however far past its departure date", () => {
    const s = deriveStayState(departedWithLiveRows);
    expect(s.overdueState).toBeNull();
    expect(s.overstayedNights).toBe(0);
  });

  it("reports the stay as departed", () => {
    expect(deriveStayState(departedWithLiveRows).departed).toBe(true);
  });
});

describe("deriveStayState — overdue states", () => {
  it("past the departure date and still in-house is an overstay, counted in nights", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [live], checkOutDate: "2026-08-20" });
    expect(s.overdueState).toBe("overstayed");
    expect(s.overstayedNights).toBe(3);
  });

  it("due out today past the checkout time is only a nudge", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [live], checkOutDate: "2026-08-23" });
    expect(s.overdueState).toBe("past_time");
    expect(s.pastTimeMinutes).toBe(60);
    expect(s.overstayedNights).toBe(0);
  });

  it("due out today BEFORE the checkout time is not overdue at all", () => {
    const s = deriveStayState({
      ...base, nowMinutes: 10 * 60, departedAt: null, assignments: [live], checkOutDate: "2026-08-23",
    });
    expect(s.overdueState).toBeNull();
  });

  it("exactly at the checkout minute is not yet late", () => {
    const s = deriveStayState({
      ...base, nowMinutes: 11 * 60, departedAt: null, assignments: [live], checkOutDate: "2026-08-23",
    });
    expect(s.overdueState).toBeNull();
  });

  it("a future departure is never overdue, whatever the clock says", () => {
    const s = deriveStayState({
      ...base, nowMinutes: 23 * 60, departedAt: null, assignments: [live], checkOutDate: "2026-08-30",
    });
    expect(s.overdueState).toBeNull();
  });

  it("a stay that is not in the house is never overdue", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [], checkOutDate: "2026-01-01" });
    expect(s.overdueState).toBeNull();
  });

  it("counts a long overstay in whole nights across a month boundary", () => {
    const s = deriveStayState({ ...base, departedAt: null, assignments: [live], checkOutDate: "2026-07-13" });
    expect(s.overstayedNights).toBe(41);
  });
});

describe("canCheckIn", () => {
  it("allows a stay that has not departed", () => {
    expect(canCheckIn({ departedAt: null })).toEqual({ allowed: true });
  });

  it("refuses a departed stay, naming the reason", () => {
    // The refusal is only safe because a manager can reopen the stay; a block with no inverse would
    // be the same deadlock in the other direction.
    expect(canCheckIn({ departedAt: new Date("2026-07-21T14:18:00Z") })).toEqual({
      allowed: false,
      reason: "departed",
    });
  });
});

describe("canCancel", () => {
  it("allows cancelling a booking nobody has arrived for", () => {
    expect(canCancel({ assignments: [], departedAt: null })).toEqual({ allowed: true });
  });

  it("allows cancelling when the only assignment is already checked out", () => {
    expect(canCancel({ assignments: [checkedOut], departedAt: null })).toEqual({ allowed: true });
  });

  it("refuses to cancel a stay the guest is standing in", () => {
    // Cancelling restores availability. Doing that while a room is physically occupied puts it back
    // on sale with someone in it — the double-booking this platform exists to prevent, reached from
    // the inside. Production carried exactly this row.
    expect(canCancel({ assignments: [live], departedAt: null })).toEqual({
      allowed: false,
      reason: "in_house",
    });
  });

  it("refuses on a room move too — the moved row is stale, the live one is not", () => {
    expect(canCancel({ assignments: [moved, live], departedAt: null })).toEqual({
      allowed: false,
      reason: "in_house",
    });
  });

  it("refuses a departed stay, which is cancelled by nothing — it already happened", () => {
    expect(canCancel({ assignments: [checkedOut], departedAt: new Date("2026-07-21T14:18:00Z") })).toEqual({
      allowed: false,
      reason: "departed",
    });
  });
});
