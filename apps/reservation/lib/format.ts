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
