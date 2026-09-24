/**
 * When the two scheduled guest emails are due — "Before arrival" and "After departure".
 *
 * Pure and here, beside the templates, so the rule is one tested function rather than a query that
 * quietly decides who gets mail. Everything is in the HOTEL's calendar: `today` and `localHour` are
 * the property's own, never the server's (a Bulgarian hotel's morning is 06:00 UTC).
 *
 * ## The rule
 *
 * - Sent in the morning at the hotel (from 09:00), never at night.
 * - **Before arrival:** three days before check-in. A stay booked closer than that still gets it,
 *   the next morning, as long as arrival is still ahead (tomorrow at the latest) — a note after the
 *   guest has arrived is nonsense.
 * - **After departure:** the morning after check-out, with one day of catch-up if a morning was
 *   missed. Never for a stay that ended earlier — switching the email on must not mail every past
 *   guest the hotel ever had.
 * - Only stays that happened or will happen: never cancelled, never a no-show (after departure).
 * - Once per stay, ever (`preArrivalMailedAt` / `postStayMailedAt`), whatever the outcome.
 */

export const SEND_FROM_HOUR = 9;
export const PRE_ARRIVAL_DAYS = 3;

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface GuestMailFacts {
  status: string;
  checkIn: string;
  checkOut: string;
  departed: boolean;
  preArrivalMailed: boolean;
  postStayMailed: boolean;
}

export function guestMailDue(
  r: GuestMailFacts,
  hotel: { today: string; localHour: number },
): "pre_arrival" | "post_stay" | null {
  if (hotel.localHour < SEND_FROM_HOUR) return null;
  if (r.status === "cancelled" || r.status === "failed_import" || r.status === "hold") return null;

  const tomorrow = addDays(hotel.today, 1);
  const horizon = addDays(hotel.today, PRE_ARRIVAL_DAYS);
  if (!r.preArrivalMailed && !r.departed && r.checkIn >= tomorrow && r.checkIn <= horizon) return "pre_arrival";

  const yesterday = addDays(hotel.today, -1);
  const dayBefore = addDays(hotel.today, -2);
  if (!r.postStayMailed && r.status !== "no_show" && r.checkOut >= dayBefore && r.checkOut <= yesterday) return "post_stay";

  return null;
}

/** The window of check-in and check-out dates the job needs to read, so it queries no more than that. */
export function guestMailWindow(today: string): { checkInFrom: string; checkInTo: string; checkOutFrom: string; checkOutTo: string } {
  return {
    checkInFrom: addDays(today, 1),
    checkInTo: addDays(today, PRE_ARRIVAL_DAYS),
    checkOutFrom: addDays(today, -2),
    checkOutTo: addDays(today, -1),
  };
}
