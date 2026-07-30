"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAYS, addDays, fmtDay, fmtDayLong, fmtMonth, monthGrid, nightsBetween, parseISO, todayISO,
} from "@/lib/dates";

/**
 * The date-range calendar.
 *
 * This replaced two native date inputs, and it is the single largest usability change on the page.
 * A native input cannot express a RANGE: the guest picks an arrival, the field closes, they pick a
 * departure with no memory of the first, and nothing on screen ever shows them the shape of the
 * stay. Here both ends live on one grid, the nights between them are tinted, and the count is stated
 * in words — so "four nights over the long weekend" is something you can see rather than compute.
 *
 * Two months on desktop, one on mobile, from the same markup: the second month is hidden with a
 * media query rather than measured in JavaScript, so the server and the client always agree.
 */

const MAX_MONTHS_AHEAD = 18;

export function DateRangePanel({
  checkIn,
  checkOut,
  onSelect,
  onDone,
}: {
  checkIn: string | null;
  checkOut: string | null;
  onSelect: (checkIn: string | null, checkOut: string | null) => void;
  onDone: () => void;
}) {
  const today = useMemo(todayISO, []);
  const anchor = checkIn ?? today;

  const [cursor, setCursor] = useState(() => ({
    year: parseISO(anchor).getUTCFullYear(),
    month: parseISO(anchor).getUTCMonth(),
  }));
  const [hover, setHover] = useState<string | null>(null);
  const [focusISO, setFocusISO] = useState<string>(anchor);

  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Move real focus to wherever the arrow keys pointed. Without this the grid is tabbable but not
   * navigable, which is worse than a plain input for anyone not using a mouse.
   *
   * `preventScroll` matters more than it looks. This effect also runs on mount, so opening the
   * calendar focused a day button — and the browser scrolled that button into view, dragging the
   * whole hero up the screen the instant a guest touched the date field. It was invisible on the
   * results page only because the bar already sits at the top there. The day is always rendered
   * (paging follows the focus), so nothing needs scrolling into view.
   */
  useEffect(() => {
    dayRefs.current.get(focusISO)?.focus({ preventScroll: true });
  }, [focusISO]);

  const firstAllowed = useMemo(() => ({ year: parseISO(today).getUTCFullYear(), month: parseISO(today).getUTCMonth() }), [today]);
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const canGoBack = monthIndex(cursor.year, cursor.month) > monthIndex(firstAllowed.year, firstAllowed.month);
  const canGoForward =
    monthIndex(cursor.year, cursor.month) < monthIndex(firstAllowed.year, firstAllowed.month) + MAX_MONTHS_AHEAD;

  function shiftMonths(by: number) {
    setCursor((c) => {
      const i = monthIndex(c.year, c.month) + by;
      return { year: Math.floor(i / 12), month: i % 12 };
    });
  }

  /** Keep the focused date on screen — arrowing off the edge of a month should turn the page. */
  function moveFocus(nextISO: string) {
    if (nextISO < today) return;
    setFocusISO(nextISO);
    const d = parseISO(nextISO);
    const i = monthIndex(d.getUTCFullYear(), d.getUTCMonth());
    const left = monthIndex(cursor.year, cursor.month);
    if (i < left) shiftMonths(i - left);
    else if (i > left + 1) shiftMonths(i - left - 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(addDays(focusISO, step[e.key]!));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const d = parseISO(focusISO);
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (e.key === "PageUp" ? -1 : 1), d.getUTCDate()));
      moveFocus(target.toISOString().slice(0, 10));
    }
  }

  /**
   * One tap sets the arrival, the next sets the departure. Tapping a date at or before the arrival
   * starts over rather than erroring — someone clicking backwards has changed their mind about when
   * they are coming, not made a mistake to be scolded for.
   */
  function pick(iso: string) {
    if (!checkIn || checkOut || iso <= checkIn) {
      onSelect(iso, null);
      setHover(null);
      return;
    }
    onSelect(checkIn, iso);
    setHover(null);
    onDone();
  }

  // While only the arrival is set, the hovered date stands in for the departure so the guest can
  // see the stay take shape before committing to it.
  const provisionalEnd = checkOut ?? (checkIn && hover && hover > checkIn ? hover : null);
  const nights = checkIn && provisionalEnd ? nightsBetween(checkIn, provisionalEnd) : 0;

  return (
    <div className="w-full sm:w-[38rem]">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
        <button
          type="button"
          onClick={() => shiftMonths(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="btn btn-ghost h-11 w-11 min-h-0 rounded-full p-0 disabled:opacity-30"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="text-[15px] font-bold tracking-tight sm:hidden">{fmtMonth(cursor.year, cursor.month)}</p>
        <div className="hidden flex-1 justify-around sm:flex">
          <p className="text-[15px] font-bold tracking-tight">{fmtMonth(cursor.year, cursor.month)}</p>
          <p className="text-[15px] font-bold tracking-tight">{fmtMonth(cursor.year, cursor.month + 1)}</p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonths(1)}
          disabled={!canGoForward}
          aria-label="Next month"
          className="btn btn-ghost h-11 w-11 min-h-0 rounded-full p-0 disabled:opacity-30"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div
        ref={gridRef}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        className="grid grid-cols-1 gap-x-7 px-4 pt-3 sm:grid-cols-2 sm:px-5"
      >
        {[0, 1].map((offset) => (
          <Month
            key={offset}
            year={cursor.year}
            month={cursor.month + offset}
            today={today}
            checkIn={checkIn}
            checkOut={checkOut}
            provisionalEnd={provisionalEnd}
            focusISO={focusISO}
            className={offset === 1 ? "hidden sm:block" : undefined}
            onPick={pick}
            onHover={setHover}
            registerRef={(iso, el) => {
              if (el) dayRefs.current.set(iso, el);
              else dayRefs.current.delete(iso);
            }}
          />
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between gap-4 border-t px-4 py-3 sm:px-5"
           style={{ borderColor: "hsl(var(--line))" }}>
        <p className="text-[13px]" style={{ color: "hsl(var(--ink-soft))" }} aria-live="polite">
          {checkIn && checkOut ? (
            <>
              <span className="font-semibold" style={{ color: "hsl(var(--ink))" }}>
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
              {/* The dates are already on the two filled cells above; repeating them at 375px just
                  wraps the row onto a second line and pushes Done off-centre. */}
              <span className="hidden sm:inline">
                {" · "}
                {fmtDay(checkIn)} — {fmtDay(checkOut)}
              </span>
            </>
          ) : checkIn ? (
            <>Now choose your check-out</>
          ) : (
            <>Choose your check-in date</>
          )}
        </p>
        <div className="flex items-center gap-1">
          {checkIn && (
            <button type="button" onClick={() => onSelect(null, null)} className="btn btn-ghost px-3 text-[13px]">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            disabled={!checkIn || !checkOut}
            className="btn btn-brand px-5 text-[13.5px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Month({
  year, month, today, checkIn, checkOut, provisionalEnd, focusISO, className, onPick, onHover, registerRef,
}: {
  year: number;
  month: number;
  today: string;
  checkIn: string | null;
  checkOut: string | null;
  provisionalEnd: string | null;
  focusISO: string;
  className?: string;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
  registerRef: (iso: string, el: HTMLButtonElement | null) => void;
}) {
  // Normalise a month index that may have overflowed past December.
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  const cells = monthGrid(y, m);

  return (
    <div className={className}>
      <div className="grid grid-cols-7 pb-1" aria-hidden>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-center text-[11px] font-semibold" style={{ color: "hsl(var(--ink-faint))" }}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />;

          const isPast = iso < today;
          const isStart = iso === checkIn;
          const isEnd = iso === checkOut;
          const inRange = !!checkIn && !!provisionalEnd && iso > checkIn && iso < provisionalEnd;
          const isProvisionalEnd = !checkOut && iso === provisionalEnd;

          return (
            <button
              key={iso}
              type="button"
              ref={(el) => registerRef(iso, el)}
              disabled={isPast}
              // Roving tabindex: one stop for the whole grid, then arrow keys inside it.
              tabIndex={iso === focusISO ? 0 : -1}
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover(iso)}
              onFocus={() => onHover(iso)}
              aria-label={fmtDayLong(iso)}
              aria-pressed={isStart || isEnd}
              className="day"
              data-selected={isStart || isEnd || isProvisionalEnd ? "true" : undefined}
              data-in-range={inRange ? "true" : undefined}
              data-edge={isStart ? "start" : isEnd || isProvisionalEnd ? "end" : undefined}
              data-today={iso === today ? "true" : undefined}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
