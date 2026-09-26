import { LOCALE_LABELS, type Locale } from "@revio/ui/i18n";
import { relativeTime } from "../format";

/**
 * "5 min ago" in the reader's language. English keeps its exact current form; every other language
 * is worded by `Intl.RelativeTimeFormat`, so a third language words itself.
 */
export function relativeTimeIn(locale: Locale): (date: Date | string | null | undefined) => string {
  if (locale === "en") return relativeTime;
  const rtf = new Intl.RelativeTimeFormat(LOCALE_LABELS[locale].intl, { numeric: "always", style: "short" });
  return (date) => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    const secs = Math.round((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return rtf.format(-secs, "second");
    const mins = Math.round(secs / 60);
    if (mins < 60) return rtf.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return rtf.format(-hrs, "hour");
    return rtf.format(-Math.round(hrs / 24), "day");
  };
}
