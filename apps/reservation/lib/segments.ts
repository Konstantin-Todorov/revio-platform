import { SOLD_STATUSES } from "@revio/core";

/**
 * The shape of the day, above the reservation list.
 *
 * ## Why tabs rather than another filter
 *
 * The list already has five filters — text, status, date type and a date range — and every one of
 * them asks the reader to know what they are looking for before they can look. A receptionist
 * opening this screen has a different question: *what is happening today?* Four numbers answer it
 * before anything is clicked, which is rule 2 of `docs/UI-STANDARD.md` — position and grouping carry
 * the meaning, the words confirm it.
 *
 * ## ⚠️ A segment is a SHORTCUT, never a second filtering system
 *
 * Each tab sets the search params the page already understands, and the same query runs. That is the
 * whole design: a parallel "segment" path through the data would be a second definition of
 * "arriving today" and, on the evidence of this week, the two would disagree within a fortnight and
 * the screen would show one number and list another.
 *
 * So `params` below is exactly what the existing filter form would have produced by hand.
 */

/** Reservation statuses that mean a real, live stay — the ones a day's work is about. */
export const LIVE_STATUSES = SOLD_STATUSES;

export interface ReservationSegment {
  key: string;
  label: string;
  /** The search params this tab sets — the page's own filter vocabulary, nothing new. */
  params: Record<string, string>;
  /** What the count means, for the title attribute. Absent on "All". */
  hint?: string;
}

export function reservationSegments(todayIso: string): ReservationSegment[] {
  return [
    { key: "all", label: "All", params: {} },
    {
      key: "arriving",
      label: "Arriving today",
      params: { dateType: "check_in", from: todayIso, to: todayIso },
      hint: "Confirmed stays checking in today",
    },
    {
      key: "inhouse",
      label: "In house",
      params: { dateType: "stay", from: todayIso, to: todayIso },
      hint: "Stays covering tonight — checked in and not yet departed",
    },
    {
      key: "departing",
      label: "Departing today",
      params: { dateType: "check_out", from: todayIso, to: todayIso },
      hint: "Stays whose checkout date is today",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      params: { dateType: "cancelled", from: todayIso, to: todayIso },
      hint: "Cancelled today — the ones that just freed a room",
    },
  ];
}

/**
 * Which tab is lit, given the params in the URL.
 *
 * ⚠️ Matched on the params a segment SETS, not on a stored id. A stored "current segment" would be a
 * second source of truth that can disagree with the filters actually applied — which is how a screen
 * ends up highlighting "Arriving today" while listing last month.
 *
 * Anything the segments do not describe — a hand-typed range, a text search, a status pick — lights
 * nothing rather than guessing, because a wrong highlight is worse than none.
 */
export function activeSegment(
  current: { dateType?: string; from?: string; to?: string; status?: string; q?: string },
  todayIso: string,
): string | null {
  const hasOther = Boolean(current.q || current.status);
  if (hasOther) return null;

  for (const seg of reservationSegments(todayIso)) {
    const p = seg.params;
    if (seg.key === "all") continue;
    if (current.dateType === p.dateType && current.from === p.from && current.to === p.to) return seg.key;
  }

  // "All" only when genuinely nothing is filtering.
  return !current.dateType && !current.from && !current.to ? "all" : null;
}

/** The href for a segment, preserving nothing — a tab is a fresh question, not a refinement. */
export function segmentHref(seg: ReservationSegment): string {
  const qs = new URLSearchParams(seg.params).toString();
  return qs ? `/reservations?${qs}` : "/reservations";
}
