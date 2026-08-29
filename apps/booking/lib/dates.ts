/**
 * Booking-app date + money helpers.
 *
 * ⚠️ The CALENDAR helpers moved to `@revio/core` when RevioCRS needed the same two-month range
 * picker (E2). They are re-exported here so every existing import in this app keeps working and so
 * there is exactly one implementation — a second copy is how two calendars start disagreeing about
 * which day a stay begins.
 */
export {
  DAY_MS, toISO, todayISO, parseISO, addDays, nightsBetween, isValidISO,
  fmtDay, fmtDayLong, fmtMonth, WEEKDAYS, monthGrid,
} from "@revio/core";

/** Money for display. Minor units in, a formatted string out — never floats in the maths. */
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
