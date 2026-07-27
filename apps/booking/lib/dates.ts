/**
 * Calendar-date helpers, safe on both sides of the network.
 *
 * Two rules run through all of it. "Today" comes from the guest's LOCAL calendar — someone in
 * UTC+3 at one in the morning must not be told they are trying to book yesterday. Everything else
 * is anchored to UTC noon-free midnight, because a stay is a run of calendar dates, not an instant,
 * and doing the arithmetic in local time makes a night vanish or double on a DST boundary.
 */

export const DAY_MS = 86_400_000;

/** A Date → its local calendar date as YYYY-MM-DD. */
export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

/** YYYY-MM-DD → a UTC-anchored Date, for arithmetic and formatting only. */
export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, n: number): string {
  return new Date(parseISO(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round((parseISO(checkOut).getTime() - parseISO(checkIn).getTime()) / DAY_MS));
}

export function isValidISO(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseISO(v).getTime());
}

/** "Fri 5 Sep" — short, and unambiguous in a way 05/09 never is across locales. */
export function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(parseISO(iso));
}

/** "Friday 5 September 2026" — for screen readers, where abbreviations read badly. */
export function fmtDayLong(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(parseISO(iso));
}

export function fmtMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month, 1)));
}

/** Monday-first weekday initials, matching how most of Europe reads a calendar. */
export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/**
 * One month as a flat 7-column grid. Leading blanks are null so the first of the month lands under
 * the right weekday; trailing blanks are omitted, since an empty final row is just dead space.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // shift Sunday=0 to Monday=0
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (string | null)[] = Array<string | null>(lead).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

/** Money for display. Minor units in, a formatted string out — never floats in the maths. */
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
