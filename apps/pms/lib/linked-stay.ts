import "server-only";
import type { TenantTx } from "@revio/db";
import { prisma } from "./db";
import { ymd } from "./format";

/**
 * Stays that continue one another — the linked reservation an extension of a channel booking makes
 * (`actions-extend.ts`), sharing the first stay's `bookingGroupId`.
 *
 * Two reservations, one guest in one room. The desk must not have to treat them as two arrivals and
 * two departures, so:
 *   - checking in the first checks in the continuation, which starts the day the first ends;
 *   - checking out the first does not send the room to housekeeping while the guest is still in it.
 *
 * A continuation is precise, not inferred from a note: the same group, the same room, an assignment
 * starting exactly when this one ends. A sibling room of a group booking never matches — it is
 * another room.
 */

type Db = Pick<TenantTx, "roomAssignment" | "reservation">;

interface Ending { reservationId: string; unitId: string; checkOut: Date }

/** Active assignments that pick up where these end. */
export async function continuationsOf(client: TenantTx | typeof prisma, endings: Ending[]) {
  const db = client as Db;
  if (endings.length === 0) return [];
  const own = await db.reservation.findMany({
    where: { id: { in: [...new Set(endings.map((e) => e.reservationId))] } },
    select: { id: true, bookingGroupId: true },
  });
  const group = new Map(own.map((r) => [r.id, r.bookingGroupId]));
  const out: { id: string; reservationId: string; unitId: string; checkedInAt: Date | null }[] = [];
  for (const e of endings) {
    const g = group.get(e.reservationId);
    if (!g) continue;
    const next = await db.roomAssignment.findMany({
      where: {
        unitId: e.unitId, status: "active", checkedOutAt: null, checkIn: e.checkOut,
        reservationId: { not: e.reservationId },
        reservation: { bookingGroupId: g, departedAt: null, status: { not: "cancelled" } },
      },
      select: { id: true, reservationId: true, unitId: true, checkedInAt: true },
    });
    out.push(...next);
  }
  return out;
}

/** The other stays of this reservation's group, for the reservation view. */
export async function linkedStays(reservationId: string) {
  const r = await prisma.reservation.findFirst({ where: { id: reservationId }, select: { bookingGroupId: true } });
  if (!r?.bookingGroupId) return [];
  const rows = await prisma.reservation.findMany({
    where: { bookingGroupId: r.bookingGroupId, id: { not: reservationId }, status: { not: "cancelled" } },
    select: { id: true, channelId: true, lines: { select: { checkIn: true, checkOut: true } } },
    orderBy: { importedAt: "asc" },
  });
  return rows.map((x) => ({
    id: x.id,
    fromChannel: x.channelId != null,
    checkIn: x.lines.length ? ymd(new Date(Math.min(...x.lines.map((l) => l.checkIn.getTime())))) : null,
    checkOut: x.lines.length ? ymd(new Date(Math.max(...x.lines.map((l) => l.checkOut.getTime())))) : null,
  }));
}
