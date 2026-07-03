/**
 * The CRS formula sheet — ONE implementation read by Dashboard AND Reports
 * (docs/CRS-REFERENCE.md "Core metrics"). Everything builds on the room-night:
 * one room × one night (2 rooms × 3 nights = 6 room-nights).
 *
 * - Available Room-Nights = (Physical − Out-of-order − Closed) × nights — capacity, so the manual
 *   "rooms to sell" cap does NOT reduce it.
 * - Room Revenue = accommodation only, prorated per night when a stay straddles the range edge.
 * - No-shows count as sold by default (the room was held; usually charged) — togglable.
 * - Net revenue = gross − channel commission; direct bookings carry no commission.
 *
 * Pure functions only — see packages/core/CLAUDE.md.
 */

/** Reservation statuses that count as sold for metrics (SOLD_STATUSES minus no_show when toggled off). */
export function soldStatusesFor(countNoShows: boolean): string[] {
  return countNoShows
    ? ["confirmed", "modified", "overbooked", "no_show"]
    : ["confirmed", "modified", "overbooked"];
}

export interface MetricLine {
  status: string;
  quantity: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (exclusive)
  /** Whole-line accommodation price in minor units; null when unknown (legacy imports). */
  priceMinor: number | null;
  /** Channel commission percent for net revenue; 0/undefined for direct bookings. */
  commissionPct?: number;
}

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  endExcl: string; // YYYY-MM-DD exclusive
}

const DAY = 86_400_000;
const t = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

/** Nights of [checkIn, checkOut) that fall inside [range.start, range.endExcl). */
export function nightsInRange(checkIn: string, checkOut: string, range: DateRange): number {
  const from = Math.max(t(checkIn), t(range.start));
  const to = Math.min(t(checkOut), t(range.endExcl));
  return Math.max(0, Math.round((to - from) / DAY));
}

export function stayNights(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round((t(checkOut) - t(checkIn)) / DAY));
}

export interface StayTotals {
  /** Σ rooms × nights inside the range, sold statuses only. */
  roomsSoldNights: number;
  /** Accommodation revenue prorated to the range, minor units (gross). */
  roomRevenueMinor: number;
  /** Gross − channel commission. */
  netRevenueMinor: number;
}

/** Aggregate sold room-nights + prorated revenue for a range. */
export function stayTotals(lines: MetricLine[], range: DateRange, opts: { countNoShows: boolean }): StayTotals {
  const sold = new Set(soldStatusesFor(opts.countNoShows));
  let roomsSoldNights = 0;
  let roomRevenueMinor = 0;
  let netRevenueMinor = 0;
  for (const line of lines) {
    if (!sold.has(line.status)) continue;
    const inRange = nightsInRange(line.checkIn, line.checkOut, range);
    if (inRange === 0) continue;
    roomsSoldNights += line.quantity * inRange;
    const total = stayNights(line.checkIn, line.checkOut);
    if (line.priceMinor != null && total > 0) {
      const revenue = Math.round((line.priceMinor * inRange) / total);
      roomRevenueMinor += revenue;
      netRevenueMinor += Math.round(revenue * (1 - (line.commissionPct ?? 0) / 100));
    }
  }
  return { roomsSoldNights, roomRevenueMinor, netRevenueMinor };
}

/** Rooms Sold ÷ Available Room-Nights × 100. */
export function occupancyPct(roomsSoldNights: number, availableRoomNights: number): number {
  return availableRoomNights > 0 ? (roomsSoldNights / availableRoomNights) * 100 : 0;
}

/** Room Revenue ÷ Rooms Sold — the achieved average daily rate. */
export function adrMinor(roomRevenueMinor: number, roomsSoldNights: number): number {
  return roomsSoldNights > 0 ? Math.round(roomRevenueMinor / roomsSoldNights) : 0;
}

/** Room Revenue ÷ Available Room-Nights (= ADR × Occupancy) — the #1 hotel KPI. */
export function revparMinor(roomRevenueMinor: number, availableRoomNights: number): number {
  return availableRoomNights > 0 ? Math.round(roomRevenueMinor / availableRoomNights) : 0;
}

/** Headline Dashboard card: cancelled reservations ÷ total created × 100. */
export function cancellationRatePct(cancelledCount: number, totalCreated: number): number {
  return totalCreated > 0 ? (cancelledCount / totalCreated) * 100 : 0;
}

/** Cancellation Report variant — weights by stay length. */
export function cancelledRoomNightRatePct(cancelledRoomNights: number, grossBookedRoomNights: number): number {
  return grossBookedRoomNights > 0 ? (cancelledRoomNights / grossBookedRoomNights) * 100 : 0;
}

/** Total booked room-nights ÷ reservations. */
export function averageLosNights(totalRoomNights: number, reservationCount: number): number {
  return reservationCount > 0 ? totalRoomNights / reservationCount : 0;
}

/** avg(check-in − booking creation), in days. Inputs are (bookedAtIso, checkInIso) pairs. */
export function averageLeadTimeDays(pairs: [string, string][]): number {
  if (pairs.length === 0) return 0;
  const sum = pairs.reduce((acc, [booked, checkIn]) => acc + Math.max(0, (t(checkIn) - t(booked.slice(0, 10))) / DAY), 0);
  return sum / pairs.length;
}

/** Pickup: rooms sold for a future range NOW − sold for the same range at the stored snapshot. */
export function pickup(roomsSoldNow: number, roomsSoldAtSnapshot: number): number {
  return roomsSoldNow - roomsSoldAtSnapshot;
}
