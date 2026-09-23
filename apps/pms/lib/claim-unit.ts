import type { TenantTx } from "@revio/db";

/**
 * Put a stay into a physical room — the write that decides whether two guests share one door.
 *
 * Every path that assigns a room goes through here: auto-assignment, check-in, the walk-in and a
 * room move. Kept free of `server-only` and of the session-bound client so
 * `scripts/unit-claim-race.ts` can race the same code those paths run. Call it INSIDE
 * `withTenantTransaction`; it takes that transaction's client.
 */
export interface UnitClaim {
  tenantId: string;
  propertyId: string;
  reservationId: string;
  reservationLineId: string;
  unitId: string;
  checkIn: Date;
  checkOut: Date;
  checkedInAt?: Date | null;
  pinned?: boolean;
  note?: string | null;
}

/*
 * ⚠️ The UNIT row is locked before anything is counted, and until 2026-09-23 nothing was.
 *
 * Every path checked for a clash and then wrote the assignment — auto-assignment inside a
 * transaction, whose own comment called that check "the difference between a fast placement and two
 * guests behind one door". A transaction does not make check-then-write safe: under READ COMMITTED
 * two of them both count zero, because neither sees the other's uncommitted row.
 * `scripts/unit-claim-race.ts` put twelve different reservations into one room at once against the
 * check-then-write with a warm connection pool: TWELVE active assignments, one room, three runs of
 * three.
 *
 * `SELECT … FOR UPDATE` on the unit makes a second claimant wait for the first to commit, and its
 * count is then a new statement that sees the first one's assignment. The unit rather than an
 * advisory lock because the unit is the contended thing, and the same row the out-of-order write
 * (`unit-ooo.ts`) locks — so a room cannot be assigned and taken out of service at the same instant.
 */
export async function claimUnitForStay(tx: TenantTx, claim: UnitClaim) {
  await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${claim.unitId} FOR UPDATE`;
  const clash = await tx.roomAssignment.count({
    where: {
      unitId: claim.unitId, status: "active", checkedOutAt: null,
      checkIn: { lt: claim.checkOut }, checkOut: { gt: claim.checkIn },
    },
  });
  if (clash > 0) return null;
  return tx.roomAssignment.create({
    data: {
      tenantId: claim.tenantId, propertyId: claim.propertyId,
      reservationId: claim.reservationId, reservationLineId: claim.reservationLineId,
      unitId: claim.unitId, checkIn: claim.checkIn, checkOut: claim.checkOut, status: "active",
      ...(claim.checkedInAt !== undefined ? { checkedInAt: claim.checkedInAt } : {}),
      ...(claim.pinned !== undefined ? { pinned: claim.pinned } : {}),
      ...(claim.note !== undefined ? { note: claim.note } : {}),
    },
  });
}

/**
 * Thrown inside a transaction when a room was taken between the screen being drawn and the write.
 * Thrown rather than returned, so everything the transaction already wrote — the walk-in's guest and
 * reservation, the other rooms of a multi-room check-in — rolls back with it.
 */
export class RoomJustTaken extends Error {
  constructor(readonly unitLabel: string) {
    super(`Room ${unitLabel} was just given to another stay.`);
    this.name = "RoomJustTaken";
  }
}

