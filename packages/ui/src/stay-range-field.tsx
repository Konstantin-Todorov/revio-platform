"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { addDays, monthGrid, nightsBetween, parseISO, todayISO } from "@revio/core";
import { fill, LOCALE_LABELS, translate, type Locale } from "./i18n";
import { useLocale } from "./i18n-context";
import { stayRangeStrings } from "./stay-range-strings";

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
function formatters(locale: Locale) {
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

/**
 * Arrival → departure, as one two-month calendar — E2 (§3.3).
 *
 * ## The bug it actually fixes
 *
 * The spec filed this as a *click-target* problem, and it is: a native `<input type="date">` opens
 * its picker only from the little calendar glyph, so clicking the field does nothing. It is the
 * FIRST field in the new-reservation flow, which makes it the first impression of the product.
 *
 * But the deeper problem is that **a native input cannot express a range**. The clerk picks an
 * arrival, the field closes, they pick a departure with no memory of the first, and nothing on
 * screen ever shows the shape of the stay. Here both ends live on one grid, the nights between are
 * tinted, and the count is stated in words — "four nights" is something you see rather than compute.
 *
 * ## Why it writes to hidden inputs
 *
 * The CRS availability search is a plain `method="GET"` form and should stay one: it means a search
 * is a URL, so a colleague can be sent one and the back button works. So this is a *field*, not a
 * form — it renders `<input type="hidden">` for `from` and `to` and lets the surrounding form submit
 * normally.
 *
 * ## Two months from one piece of markup
 *
 * The second month is hidden by a media query rather than measured in JavaScript, so the server and
 * the client always agree about what was rendered and there is no hydration flicker.
 */

const MAX_MONTHS_AHEAD = 18;

export interface StayRangeFieldProps {
  /** Submitted field names, so this drops into an existing form unchanged. */
  fromName?: string;
  toName?: string;
  defaultFrom?: string;
  defaultTo?: string;
  /** Nothing before this is selectable. Defaults to today — a stay cannot start in the past. */
  minISO?: string;
  /** Accent classes, so each product keeps its own colour. */
  accentBg?: string;
  accentText?: string;
  label?: string;
}

export function StayRangeField({
  fromName = "from",
  toName = "to",
  defaultFrom,
  defaultTo,
  minISO,
  accentBg = "bg-brand-800",
  accentText = "text-brand-700",
  label,
}: StayRangeFieldProps) {
  const locale = useLocale();
  const t = translate(stayRangeStrings, locale);
  const { fmtDay, fmtDayLong, fmtMonth, weekdays: WEEKDAYS } = useMemo(() => formatters(locale), [locale]);
  const nightsLabel = (n: number) => fill(n === 1 ? t.nightOne : t.nightMany, { n });
  const today = useMemo(todayISO, []);
  const min = minISO ?? today;

  const [from, setFrom] = useState<string | null>(defaultFrom ?? null);
  const [to, setTo] = useState<string | null>(defaultTo ?? null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const anchor = from ?? min;
  const [cursor, setCursor] = useState(() => ({
    year: parseISO(anchor).getUTCFullYear(),
    month: parseISO(anchor).getUTCMonth(),
  }));

  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Both, because a popover that only closes one way strands
  // whichever kind of user does not know the other.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * One click handler for both ends.
   *
   * Clicking a date earlier than the current arrival restarts the range rather than producing a
   * backwards stay — the clerk has changed their mind about the arrival, which is far more likely
   * than them wanting an error message.
   */
  function pick(iso: string) {
    if (!from || to || iso <= from) {
      setFrom(iso);
      setTo(null);
      return;
    }
    setTo(iso);
    setOpen(false);
  }

  const nights = from && to ? nightsBetween(from, to) : 0;
  const summary =
    from && to
      ? `${fmtDay(from)} → ${fmtDay(to)} · ${nightsLabel(nights)}`
      : from
        ? `${fmtDay(from)} → ${t.chooseDeparture}`
        : t.chooseDates;

  const months = [cursor, nextMonth(cursor)];
  const maxISO = addDays(today, MAX_MONTHS_AHEAD * 31);

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={fromName} value={from ?? ""} />
      <input type="hidden" name={toName} value={to ?? ""} />

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {label ?? t.label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-[38px] w-full items-center gap-2 rounded-md border border-surface-border bg-white px-3 text-left text-[13px] text-ink-900 transition-colors hover:border-ink-300"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-400" />
        <span className={from && to ? "text-ink-900" : "text-ink-400"}>{summary}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.dialog}
          className="absolute left-0 top-full z-30 mt-1.5 w-[19rem] rounded-xl border border-surface-border bg-white p-3 shadow-lg sm:w-[35rem]"
        >
          <div className="mb-2 flex items-center justify-between">
            <NavButton
              dir="prev"
              disabled={`${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}` <= min.slice(0, 7)}
              onClick={() => setCursor(prevMonth(cursor))}
            />
            <div className="flex flex-1 justify-around text-[12.5px] font-semibold text-ink-800">
              <span>{fmtMonth(months[0]!.year, months[0]!.month)}</span>
              <span className="hidden sm:inline">{fmtMonth(months[1]!.year, months[1]!.month)}</span>
            </div>
            <NavButton dir="next" onClick={() => setCursor(nextMonth(cursor))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {months.map((m, i) => (
              <div key={`${m.year}-${m.month}`} className={i === 1 ? "hidden sm:block" : undefined}>
                <div className="mb-1 grid grid-cols-7 text-center text-[10.5px] font-semibold text-ink-400">
                  {WEEKDAYS.map((w, wi) => (
                    <span key={wi}>{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {monthGrid(m.year, m.month).map((iso, idx) => {
                    if (!iso) return <span key={`b${idx}`} />;
                    const disabled = iso < min || iso > maxISO;
                    const isFrom = iso === from;
                    const isTo = iso === to;
                    const end = to ?? hover;
                    const inRange = Boolean(from && end && iso > from && iso < end);

                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHover(iso)}
                        aria-label={fmtDayLong(iso)}
                        aria-pressed={isFrom || isTo}
                        className={[
                          "h-8 rounded text-[12px] transition-colors",
                          disabled ? "cursor-not-allowed text-ink-300" : "hover:bg-surface-muted",
                          isFrom || isTo ? `${accentBg} font-semibold text-white hover:opacity-90` : "",
                          inRange && !isFrom && !isTo ? "bg-surface-muted" : "",
                        ].join(" ")}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-surface-border pt-2.5">
            <span className={`text-[12px] font-semibold ${accentText}`}>
              {from && to ? nightsLabel(nights) : t.clickArrival}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFrom(null);
                  setTo(null);
                }}
                className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-ink-500 hover:bg-surface-muted"
              >
                {t.clear}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-md ${accentBg} px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90`}
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ dir, onClick, disabled }: { dir: "prev" | "next"; onClick: () => void; disabled?: boolean }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={translate(stayRangeStrings, useLocale())[dir === "prev" ? "prev" : "next"]}
      className="rounded p-1 text-ink-500 transition-colors hover:bg-surface-muted disabled:opacity-30"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

const nextMonth = (c: { year: number; month: number }) =>
  c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 };
const prevMonth = (c: { year: number; month: number }) =>
  c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 };
