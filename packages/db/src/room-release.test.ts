import { describe, expect, it, vi } from "vitest";

import { releaseRoomsForCancellation } from "./room-release";

/** A stand-in that records the query, so the WHERE can be asserted — it is the whole safety story. */
function fakeDb(count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  return { db: { roomAssignment: { updateMany } }, updateMany };
}

describe("releaseRoomsForCancellation", () => {
  it("releases the rooms a cancelled booking was holding", async () => {
    const { db, updateMany } = fakeDb(2);
    await expect(releaseRoomsForCancellation(db, "res_1")).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany.mock.calls[0]![0].data).toEqual({ status: "cancelled" });
  });

  it("⚠️ never touches a room somebody has checked into", async () => {
    // The one rule in this file. An OTA cancellation can arrive while the guest is standing at the
    // desk; releasing then would put an occupied room back on sale, which is the exact
    // double-booking this platform exists to prevent. That ending is a check-out, not a release.
    const { db, updateMany } = fakeDb();
    await releaseRoomsForCancellation(db, "res_1");
    expect(updateMany.mock.calls[0]![0].where).toEqual({
      reservationId: "res_1",
      status: "active",
      checkedInAt: null,
    });
  });

  it("only touches assignments of the booking it was given", async () => {
    const { db, updateMany } = fakeDb();
    await releaseRoomsForCancellation(db, "res_abc");
    expect(updateMany.mock.calls[0]![0].where.reservationId).toBe("res_abc");
  });

  it("only touches live assignments, so a moved-from room is left as history", async () => {
    // `moved` rows are the audit trail of a room change. Re-writing them would rewrite what happened.
    const { db, updateMany } = fakeDb();
    await releaseRoomsForCancellation(db, "res_1");
    expect(updateMany.mock.calls[0]![0].where.status).toBe("active");
  });

  it("is safe to call twice", async () => {
    // Cancellations arrive more than once: a guest cancels on Booking.com, the pull runs again, and
    // an operator may cancel the same booking by hand. The second call matches nothing.
    const { db } = fakeDb(0);
    await expect(releaseRoomsForCancellation(db, "res_1")).resolves.toBe(0);
  });

  it("reports zero when the booking held no room", async () => {
    // A cancellation before anyone assigned a room is the common case and must not look like a
    // failure to the caller.
    const { db } = fakeDb(0);
    await expect(releaseRoomsForCancellation(db, "res_never_assigned")).resolves.toBe(0);
  });
});
