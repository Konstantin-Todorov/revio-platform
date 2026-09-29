import { parseISO } from "@revio/core";
import { LOCALE_LABELS, type Locale } from "./i18n";

/**
 * Dates in the reader's language, built from `formatToParts` and joined by us.
 *
 * The server (Node's ICU) and the browser (Chromium's) disagree on the punctuation of the same
 * format — "Thu, 24 Sept" against "Thu 24 Sept" — and the summary on the button is rendered on
 * both, so the page failed to hydrate. Taking only the words and placing the spaces ourselves makes
 * the two identical.
 */
function words(locale: Locale, opts: Intl.DateTimeFormatOptions) {
  const f = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { ...opts, timeZone: "UTC" });
  return (d: Date) => f.formatToParts(d).filter((p) => p.type !== "literal").map((p) => p.value).join(" ");
}
export function dateWords(locale: Locale) {
  // Some languages have no abbreviated month name — Bulgarian's "short" month is the number, which
  // reads as a date in the wrong order ("сб 10 10"). There, the month is written out.
  const numericShort = /^\d+$/.test(
    new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 1))),
  );
  const day = words(locale, { weekday: "short", day: "numeric", month: numericShort ? "long" : "short" });
  const long = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const month = words(locale, { month: "long", year: "numeric" });
  // Monday-first narrow weekday names: 2024-01-01 was a Monday.
  const narrow = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { weekday: "narrow", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => narrow.format(new Date(Date.UTC(2024, 0, 1 + i))));
  return {
    fmtDay: (iso: string) => day(parseISO(iso)),
    fmtDayLong: (iso: string) => long.format(parseISO(iso)),
    fmtMonth: (y: number, m: number) => month(new Date(Date.UTC(y, m, 1))),
    weekdays,
  };
}

