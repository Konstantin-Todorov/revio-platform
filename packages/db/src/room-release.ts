/**
 * Give the room back when a booking is cancelled.
 *
 * ## The bug this closes
 *
 * Cancelling restored AVAILABILITY — the CRS waterfall, the OTA push, all correct — and left the
 * physical `RoomAssignment` sitting at `active`. Nothing in the platform released it: not the CRS
 * cancel action, not the channel manager's, not a guest cancelling on the booking engine, and not a
 * cancellation pulled from an OTA, which is the path a real hotel uses most.
 *
 * ⚠️ A stale assignment is not cosmetic. Every occupancy check in RevioPMS counts
 * `status: "active", checkedOutAt: null` and **none of them filters cancelled reservations**:
 *
 *   - `actions-frontdesk.ts` — the check-in clash guard. A different, real guest arriving for that
 *     room is turned away with `error=busy`.
 *   - `actions-frontdesk.ts` — the room-move guard. Nobody can be moved into it either.
 *   - `auto-assign.ts` — the optimiser treats the room as taken and never places anyone in it.
 *
 * So the room is sold again on every OTA and simultaneously unusable at the front desk. That is the
 * double-booking problem this platform exists to prevent, arrived at from the other side: inventory
 * says yes, the building says no. Production carried one — a booking cancelled on 29 July still
 * holding room 110 seven weeks later.
 *
 * ## What it deliberately does NOT release
 *
 * An assignment with `checkedInAt` set. Somebody is in that room. A cancellation arriving from an
 * OTA while the guest is standing at the desk must not put an occupied room back on sale — that
 * ending is a **check-out**, on the PMS front desk, where the folio is settled and the room is sent
 * for cleaning. `cancelCrsReservation` already refuses for this reason; the other paths cannot
 * refuse (an OTA cancellation is a fact, not a request), so they leave the room held and the front
 * desk resolves it. The state audit surfaces the result either way.
 */

/** Just the slice of a Prisma client this needs, so it works with an RLS-scoped proxy or a tx. */
export interface RoomReleaseDb {
  roomAssignment: {
    updateMany: (args: {
      where: { reservationId: string; status: string; checkedInAt: null };
      data: { status: string };
    }) => Promise<{ count: number }>;
  };
}

/**
 * Release every room held by a cancelled booking that nobody has checked into.
 *
 * Returns how many were released, so a caller can log it. Safe to call twice: the second call
 * matches nothing, because the rows are no longer `active`.
 */
export async function releaseRoomsForCancellation(
  db: RoomReleaseDb,
  reservationId: string,
): Promise<number> {
  const { count } = await db.roomAssignment.updateMany({
    // `checkedInAt: null` is the whole safety property — see the note above.
    where: { reservationId, status: "active", checkedInAt: null },
    data: { status: "cancelled" },
  });
  return count;
}

/** The slice needed to ask whether anybody is actually in the room. */
export interface StayLookupDb {
  roomAssignment: {
    findFirst: (args: {
      where: { reservationId: string; status: string; checkedOutAt: null; checkedInAt: { not: null } };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * Is there a guest standing in a room this booking holds?
 *
 * ⚠️ Cancelling such a stay puts an OCCUPIED room back on sale — the double booking this platform
 * exists to prevent, arrived at from the inside. It also leaves the bill open on a reservation that
 * officially never happened; production carried exactly that, a cancelled booking in the front
 * desk's live-bills list.
 *
 * The right answer is to refuse, not to tidy up afterwards. A guest who has arrived and is leaving
 * early is a **check-out**, on the PMS front desk, where the folio is settled and the room is
 * released and sent for cleaning. That path exists and does all of it.
 *
 * This is shared because it had already drifted: `cancelCrsReservation` refused, and the channel
 * manager's `cancelReservation` — same database, same consequence — did not check at all. One
 * concept, two copies, and the second lost the guard. Production carries a booking cancelled while
 * its guest was checked in, which is how this was found.
 *
 * Callers that CANNOT refuse — an OTA cancellation is a fact, not a request — should not call this;
 * they release what they can and leave an occupied room to the front desk.
 */
export async function isStayInHouse(db: StayLookupDb, reservationId: string): Promise<boolean> {
  const found = await db.roomAssignment.findFirst({
    where: { reservationId, status: "active", checkedOutAt: null, checkedInAt: { not: null } },
    select: { id: true },
  });
  return found !== null;
}
