/**
 * Spreading a stay across the months it actually occupies.
 *
 * Extracted from `getOperatorDashboard` for one reason: the behaviour that is most likely to be wrong
 * is the one production cannot demonstrate. Every future stay in the database today begins and ends
 * inside the same month, so a version that ignored month boundaries entirely would render identical
 * numbers and look correct. The first cross-month booking would then quietly put a whole stay's
 * revenue on the wrong side of a line, on a chart whose entire job is to show when revenue lands.
 *
 * Pure and tested here, so the case the data cannot show is still pinned.
 *
 * Two mistakes this replaced, both of which shipped:
 *   - room-nights summed `quantity`, which is ROOMS — a five-night booking of one room counted as 1;
 *   - a stay's whole price was assigned to its check-in month.
 */
import { nightsInRange, stayNights } from "@revio/core";

export interface ForwardLine {
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD, exclusive — the morning they leave. */
  checkOut: string;
  /** Rooms on this line. Room-nights are this × nights, never this alone. */
  quantity: number;
  /** Whole-stay accommodation price, or null on legacy imports that never carried one. */
  priceMinor: number | null;
}

export interface MonthBucket {
  key: string;
  /** First day of the month, YYYY-MM-DD. */
  start: string;
  /** First day of the NEXT month, YYYY-MM-DD — exclusive, matching how nights are counted. */
  endExcl: string;
}

export interface ForwardTotals {
  key: string;
  roomNights: number;
  revenueMinor: number;
}

/**
 * Distribute each line's room-nights and revenue over `buckets`.
 *
 * Revenue is prorated by NIGHTS IN THE MONTH ÷ TOTAL NIGHTS — the same basis `getRangeMetrics` uses
 * in the CRS, so the operator's view of a reservation and the hotel's own cannot disagree.
 *
 * Nights outside every bucket are simply not counted: a stay that starts before the window
 * contributes only the part inside it, which is what a six-month forward view means.
 */
export function bucketForward(lines: readonly ForwardLine[], buckets: readonly MonthBucket[]): ForwardTotals[] {
  const out = new Map<string, ForwardTotals>(
    buckets.map((b) => [b.key, { key: b.key, roomNights: 0, revenueMinor: 0 }]),
  );

  for (const l of lines) {
    const total = stayNights(l.checkIn, l.checkOut);
    if (total <= 0) continue; // a zero-night stay is bad data, not a divide-by-zero
    for (const b of buckets) {
      const n = nightsInRange(l.checkIn, l.checkOut, { start: b.start, endExcl: b.endExcl });
      if (n === 0) continue;
      const bucket = out.get(b.key)!;
      bucket.roomNights += l.quantity * n;
      if (l.priceMinor != null) bucket.revenueMinor += Math.round((l.priceMinor * n) / total);
    }
  }

  return buckets.map((b) => out.get(b.key)!);
}

/** The six month-buckets starting at `from`'s month, as `bucketForward` wants them. */
export function monthBuckets(from: Date, count: number): MonthBucket[] {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const at = (i: number) => new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
  return Array.from({ length: count }, (_, i) => {
    const start = at(i);
    return {
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      start: ymd(start),
      endExcl: ymd(at(i + 1)),
    };
  });
}
