// BGN stays here although it is no longer offered as a choice: Bulgaria is on the euro, but a
// historical row denominated in лева must still render as лева rather than as a bare number.
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
export function isWeekend(d: Date): boolean {
  const n = d.getUTCDay();
  return n === 0 || n === 6;
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The forecast disclaimer, defined once (§2.2).
 *
 * It appears on the Dashboard Forecast and on the Analytics On-the-books tab, and the two had
 * drifted — the same concept in two wordings reads as two unrelated claims, and a user cannot
 * connect the views. Sharing the string is the only way it stays true; two copies of a sentence in
 * two files are two sentences.
 *
 * The honesty here is load-bearing and not decoration: these are committed bookings, not a model,
 * and the moment a hotelier reads them as a prediction the number becomes a promise we did not make.
 */
export const FORECAST_DISCLAIMER =
  "Expected values from confirmed bookings — not a prediction model. New pickup raises these; cancellations lower them.";
