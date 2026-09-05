import "server-only";
import { prisma } from "./db";
import { getProperty } from "./data";
import {
  MAX_OFFERS_PER_ENTRY,
  waitlistMetrics,
  type WaitlistMetrics,
  type WaitlistStatus,
} from "@revio/core";

/**
 * The staff view of the waitlist.
 *
 * Reads only — every write is a server action in `actions-waitlist.ts`, gated on a capability,
 * because a server action is a POST endpoint and hiding a button protects nobody.
 */

export interface WaitlistRow {
  id: string;
  guestName: string;
  guestEmail: string;
  roomTypeName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  status: WaitlistStatus;
  createdAt: Date;
  offerCount: number;
  offerExpiresAt: Date | null;
  /** Set once the entry turned into a stay — this is what "recovered" is counted from. */
  reservationId: string | null;
  source: string;
  /** True once core will stop offering to this entry, so the screen can say why it looks idle. */
  offersExhausted: boolean;
}

export interface WaitlistCounts {
  waiting: number;
  offered: number;
  converted: number;
  expired: number;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

export async function getWaitlist(status?: WaitlistStatus): Promise<{
  rows: WaitlistRow[];
  counts: WaitlistCounts;
  recovered: { count: number; valueMinor: number; currency: string };
  /**
   * The same `waitlistMetrics` the Operator console reads.
   *
   * Shared rather than recomputed per screen, for the reason that already governs the quote and the
   * push: a number we put in front of a hotel on a renewal call has to be one they can open their
   * own screen and verify. Two implementations of "conversion rate" would disagree within a month.
   */
  metrics: WaitlistMetrics;
}> {
  const property = await getProperty();

  const [all, roomTypes] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.roomType.findMany({ where: { propertyId: property.id }, select: { id: true, name: true } }),
  ]);

  const nameOf = new Map(roomTypes.map((r) => [r.id, r.name]));

  const counts: WaitlistCounts = { waiting: 0, offered: 0, converted: 0, expired: 0 };
  for (const e of all) {
    if (e.status === "waiting") counts.waiting++;
    else if (e.status === "offered") counts.offered++;
    else if (e.status === "converted") counts.converted++;
    else if (e.status === "expired" || e.status === "cancelled") counts.expired++;
  }

  /*
   * Rooms recovered this month, and what they were worth.
   *
   * This is the sentence that justifies the feature on a renewal call, so it is counted from real
   * reservations rather than from the entry rows: an entry says an offer was accepted, a reservation
   * says money exists. Value comes from the stay itself for the same reason.
   */
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // Every converted entry's stay, not just this month's — the month card and the all-time metrics
  // are then two readings of ONE set of numbers rather than two queries that can drift apart.
  const convertedAll = all.filter((e) => e.status === "converted" && e.reservationId);
  const valueByReservation = new Map<string, number>();
  if (convertedAll.length > 0) {
    const res = await prisma.reservation.findMany({
      where: { id: { in: convertedAll.map((e) => e.reservationId!) } },
      select: { id: true, totalMinor: true, propertyTotalMinor: true },
    });
    // `propertyTotalMinor` is the base-currency snapshot; it is null for a hotel that only ever
    // sells in its own currency, and falling through to `totalMinor` keeps those from reading €0.
    for (const r of res) valueByReservation.set(r.id, r.propertyTotalMinor ?? r.totalMinor);
  }

  const convertedThisMonth = convertedAll.filter((e) => e.updatedAt >= monthStart);
  const valueMinor = convertedThisMonth.reduce(
    (sum, e) => sum + (valueByReservation.get(e.reservationId!) ?? 0),
    0,
  );

  const metrics = waitlistMetrics(
    all.map((e) => ({
      status: e.status as WaitlistStatus,
      createdAt: e.createdAt,
      offeredAt: e.offeredAt,
      offerCount: e.offerCount,
      // Null rather than 0 when the stay is gone: `reservationId` is SET NULL, and the metrics
      // count that apart so recovered revenue is never quietly understated.
      recoveredMinor:
        e.status === "converted" && e.reservationId
          ? (valueByReservation.get(e.reservationId) ?? null)
          : null,
    })),
  );

  const filtered = status
    ? all.filter((e) =>
        status === "expired"
          ? e.status === "expired" || e.status === "cancelled"
          : e.status === status,
      )
    : all;

  return {
    rows: filtered.map((e) => ({
      id: e.id,
      guestName: e.guestName,
      guestEmail: e.guestEmail,
      roomTypeName: e.roomTypeId ? (nameOf.get(e.roomTypeId) ?? null) : null,
      checkIn: ymd(e.checkIn),
      checkOut: ymd(e.checkOut),
      nights: Math.max(1, Math.round((e.checkOut.getTime() - e.checkIn.getTime()) / DAY)),
      guests: e.guests,
      status: e.status as WaitlistStatus,
      createdAt: e.createdAt,
      offerCount: e.offerCount,
      offerExpiresAt: e.offerExpiresAt,
      reservationId: e.reservationId,
      source: e.source,
      offersExhausted: e.offerCount >= MAX_OFFERS_PER_ENTRY,
    })),
    counts,
    recovered: {
      count: convertedThisMonth.length,
      valueMinor,
      currency: property.baseCurrency,
    },
    metrics,
  };
}
