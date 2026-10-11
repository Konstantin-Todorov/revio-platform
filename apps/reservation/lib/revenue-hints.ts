import "server-only";
import { revenueHints, SOLD_STATUSES, type HintNight, type RevenueHint } from "@revio/core";
import { prisma } from "./db";
import { addDays, getInventoryBoard, ymd } from "./data";

/** How far ahead the hints look. The inventory board reads at most 31 nights in one call. */
const HORIZON_NIGHTS = 31;

/**
 * Gather the nights `revenueHints` reasons about: the inventory board (capacity, sold and the
 * headline price — the same numbers the calendar and the Channex push use), the pickup snapshot from
 * a week ago, and what sold on the same weekday last year. The judgement lives in `@revio/core`;
 * this only reads.
 */
export async function getRevenueHints(todayIso: string): Promise<RevenueHint[]> {
  const board = await getInventoryBoard({ start: todayIso, days: HORIZON_NIGHTS });
  const propertyId = board.property.id;
  const today = new Date(`${todayIso}T00:00:00Z`);
  const end = addDays(today, HORIZON_NIGHTS);
  const weekAgo = addDays(today, -7);
  const lyStart = addDays(today, -364);
  const lyEnd = addDays(end, -364);

  const [snapshot, lastYearLines] = await Promise.all([
    // The newest snapshot taken on or before a week ago — pickup needs a fixed point to count from.
    prisma.pickupSnapshot.findFirst({
      where: { propertyId, snapshotDate: { lte: weekAgo, gte: addDays(weekAgo, -3) } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true },
    }).then((s) => s
      ? prisma.pickupSnapshot.findMany({
          where: { propertyId, snapshotDate: s.snapshotDate, targetDate: { gte: today, lt: end } },
          select: { roomTypeId: true, targetDate: true, roomsSold: true },
        })
      : null),
    prisma.reservationLine.findMany({
      where: {
        roomTypeId: { in: board.sections.map((s) => s.roomType.id) },
        reservation: { propertyId, status: { in: [...SOLD_STATUSES] } },
        checkIn: { lt: lyEnd },
        checkOut: { gt: lyStart },
      },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    }),
  ]);

  const weekAgoSold = snapshot
    ? new Map(snapshot.map((r) => [`${r.roomTypeId}:${ymd(r.targetDate)}`, r.roomsSold]))
    : null;
  // Any booking at all last year is what makes "last year" a thing we know; zero is then a real zero.
  const hasHistory = lastYearLines.length > 0;
  const lastYear = new Map<string, number>();
  for (const l of lastYearLines) {
    const from = Math.max(l.checkIn.getTime(), lyStart.getTime());
    const to = Math.min(l.checkOut.getTime(), lyEnd.getTime());
    for (let t = from; t < to; t += 86_400_000) {
      const key = `${l.roomTypeId}:${ymd(addDays(new Date(t), 364))}`;
      lastYear.set(key, (lastYear.get(key) ?? 0) + l.quantity);
    }
  }

  const nights: HintNight[] = [];
  for (const section of board.sections) {
    section.cells.forEach((cell, i) => {
      const date = board.dates[i]!;
      const key = `${section.roomType.id}:${date}`;
      nights.push({
        date,
        daysOut: i,
        roomTypeId: section.roomType.id,
        roomTypeName: section.roomType.name,
        capacity: cell.available,
        sold: cell.confirmed,
        priceMinor: cell.priceMinor ?? null,
        // A snapshot stores only rows with sales, so a missing row is a real zero — once one exists.
        soldWeekAgo: weekAgoSold ? (weekAgoSold.get(key) ?? 0) : null,
        soldLastYear: hasHistory ? (lastYear.get(key) ?? 0) : null,
      });
    });
  }
  return revenueHints(nights);
}
