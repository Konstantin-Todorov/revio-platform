import "server-only";
import { prisma } from "./db";

/**
 * Release expired holds — the background job the Hold mechanism depends on (docs/CRS-REFERENCE.md
 * "System jobs": every few minutes). Runs lazily on reservation-flow page loads + via the cron
 * route, same pattern as the pickup snapshot. Marking a hold `expired` frees its inventory
 * instantly everywhere, because every availability read derives holds from status=active rows.
 * Draft/hold reservations linked to an expired hold move to `expired` too.
 */
export async function releaseExpiredHolds(client = prisma) {
  const now = new Date();
  const stale = await client.hold.findMany({
    where: { status: "active", expiresAt: { lte: now } },
    select: { id: true, reservationId: true },
  });
  if (stale.length === 0) return 0;

  await client.hold.updateMany({
    where: { id: { in: stale.map((h) => h.id) } },
    data: { status: "expired" },
  });
  const resIds = stale.map((h) => h.reservationId).filter((id): id is string => id != null);
  if (resIds.length > 0) {
    await client.reservation.updateMany({
      where: { id: { in: resIds }, status: { in: ["draft", "hold"] } },
      data: { status: "expired" },
    });
  }
  return stale.length;
}
