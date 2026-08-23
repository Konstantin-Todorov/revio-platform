const SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", BGN: "лв" };

export function money(minor: number, currency = "EUR"): string {
  const sym = SYMBOLS[currency] ?? currency + " ";
  const value = (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${value}`;
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekday(d: Date): string {
  return WD[d.getUTCDay()]!;
}
export function dayMonth(d: Date): string {
  return `${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date (YYYY-MM-DD) in the property's timezone — all PMS date logic uses this. */
export function todayInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Add `days` to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDaysYmd(dateYmd: string, days: number): string {
  const d = new Date(dateYmd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string into a UTC-midnight Date (for @db.Date columns). */
export function utcDay(dateYmd: string): Date {
  return new Date(dateYmd + "T00:00:00Z");
}

/**
 * Minutes since midnight, right now, in the given IANA timezone.
 *
 * Lives here beside `todayInTz` because "what time is it at the property" is one question, and it is
 * now asked by two callers: the overdue-past-checkout check on the front desk, and the Close Day
 * escalation. It was private to data.ts, which is how the second caller nearly got its own copy.
 */
export function minutesOfDayInTz(timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + m;
}
