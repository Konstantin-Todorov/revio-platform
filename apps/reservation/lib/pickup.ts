import "server-only";
import { SOLD_STATUSES } from "@revio/core";
import { prisma } from "./db";
import { addDays, todayInTz, ymd } from "./data";

/** How far forward a snapshot measures rooms sold. */
const SNAPSHOT_HORIZON_DAYS = 90;

/**
 * Record today's rooms-sold per (room type, future stay date) — the raw material for Pickup
 * (sold NOW − sold at the snapshot N days ago). Snapshots can never be backfilled, which is why
 * this job exists from Phase 1 day one (docs/CRS-REFERENCE.md "System jobs").
 *
 * Lazy-triggered on Dashboard/Inventory loads (first visit of the property-timezone day wins;
 * `skipDuplicates` makes races harmless) and callable from the cron route for scheduled runs.
 * Only rows with sold > 0 are stored — an absent row reads as 0.
 */
export async function ensurePickupSnapshot(client = prisma) {
  const properties = await client.property.findMany({
    select: { id: true, tenantId: true, timezone: true },
  });

  for (const property of properties) {
    const todayIso = todayInTz(property.timezone);
    const today = new Date(`${todayIso}T00:00:00Z`);

    const existing = await client.pickupSnapshot.findFirst({
      where: { propertyId: property.id, snapshotDate: today },
      select: { id: true },
    });
    if (existing) continue;

    const end = addDays(today, SNAPSHOT_HORIZON_DAYS);
    const lines = await client.reservationLine.findMany({
      where: {
        reservation: { propertyId: property.id, status: { in: [...SOLD_STATUSES] } },
        checkIn: { lt: end },
        checkOut: { gt: today },
      },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    });

    // Room-nights per (room type, stay date) inside the horizon.
    const sold = new Map<string, number>();
    for (const line of lines) {
      const from = Math.max(line.checkIn.getTime(), today.getTime());
      const to = Math.min(line.checkOut.getTime(), end.getTime());
      for (let t = from; t < to; t += 86_400_000) {
        const key = `${line.roomTypeId}:${ymd(new Date(t))}`;
        sold.set(key, (sold.get(key) ?? 0) + line.quantity);
      }
    }

    if (sold.size === 0) continue;
    await client.pickupSnapshot.createMany({
      data: [...sold.entries()].map(([key, roomsSold]) => {
        const [roomTypeId, date] = key.split(":") as [string, string];
        return {
          tenantId: property.tenantId,
          propertyId: property.id,
          roomTypeId,
          snapshotDate: today,
          targetDate: new Date(`${date}T00:00:00Z`),
          roomsSold,
        };
      }),
      skipDuplicates: true,
    });
  }
}

/** Snapshot coverage for the active property — drives the Dashboard's pickup card. */
export async function getPickupStatus(propertyId: string, timezone: string) {
  const [first, latest, todayCount] = await Promise.all([
    prisma.pickupSnapshot.findFirst({ where: { propertyId }, orderBy: { snapshotDate: "asc" }, select: { snapshotDate: true } }),
    prisma.pickupSnapshot.findFirst({ where: { propertyId }, orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true } }),
    prisma.pickupSnapshot.count({
      where: { propertyId, snapshotDate: new Date(`${todayInTz(timezone)}T00:00:00Z`) },
    }),
  ]);
  return {
    firstSnapshot: first ? ymd(first.snapshotDate) : null,
    latestSnapshot: latest ? ymd(latest.snapshotDate) : null,
    todayRows: todayCount,
  };
}
