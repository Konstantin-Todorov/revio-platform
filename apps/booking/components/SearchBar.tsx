"use client";

import { useCallback, useState } from "react";
import { CalendarDays, Minus, Plus, Search, Users } from "lucide-react";
import { DateRangePanel } from "./DateRangePanel";
import { useDismiss } from "@/lib/use-dismiss";
import { addDays, fmtDay, isValidISO, nightsBetween, todayISO } from "@/lib/dates";

/**
 * The search bar — dates, guests, go.
 *
 * Still a plain GET form: the result is a shareable, back-button-safe URL that survives a refresh
 * and works with the browser's own history. What changed is the input model. Three loose fields
 * became one segmented control where each segment opens a panel, which is the pattern every serious
 * booking engine converged on — not for fashion, but because the two hardest things to express in
 * native form controls are a date RANGE and a party size you can adjust without reading a dropdown.
 *
 * On mobile every panel becomes a bottom sheet. A popover pinned under a segment on a 375px screen
 * either overflows the viewport or shrinks the calendar to unusable, and the sheet is the only
 * shape that gives a 44px tap target per day.
 */

const MAX_GUESTS = 10;

export function SearchBar({
  slug,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests = 2,
  compact = false,
  onDark = false,
}: {
  slug: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  /** The results-page variant: shorter segments, no helper line — it sits above live results. */
  compact?: boolean;
  /**
   * The helper line below the bar sits on the page, not on the card, so on the Bold preset's solid
   * brand banner it needs reversed ink. Only that one line — everything else is inside a white card
   * and must keep the normal palette.
   */
  onDark?: boolean;
}) {
  /**
   * Dates start filled in — tomorrow, two nights.
   *
   * An empty search bar means the primary button lands disabled, and a greyed-out Search is the
   * first thing a guest sees on a page whose whole job is to start a booking. A sensible stay they
   * can change in one tap is strictly better than a dead control plus an instruction to read.
   */
  const [checkIn, setCheckIn] = useState<string | null>(
    isValidISO(defaultCheckIn) ? defaultCheckIn : addDays(todayISO(), 1),
  );
  const [checkOut, setCheckOut] = useState<string | null>(
    isValidISO(defaultCheckOut) ? defaultCheckOut : addDays(todayISO(), 3),
  );
  const [guests, setGuests] = useState(defaultGuests);
  const [panel, setPanel] = useState<"dates" | "guests" | null>(null);

  const close = useCallback(() => setPanel(null), []);
  const ref = useDismiss<HTMLDivElement>(panel !== null, close);

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const ready = !!checkIn && !!checkOut && nights > 0;

  function onSelect(nextIn: string | null, nextOut: string | null) {
    setCheckIn(nextIn);
    setCheckOut(nextOut);
  }

  /** Jumping straight to the calendar's second half when the guest taps "Check out" first. */
  function openDates() {
    if (!checkIn) setCheckIn(addDays(todayISO(), 1));
    setPanel("dates");
  }

  return (
    <div ref={ref} className="relative">
      <form action={`/${slug}/search`} method="GET">
        <input type="hidden" name="checkIn" value={checkIn ?? ""} />
        <input type="hidden" name="checkOut" value={checkOut ?? ""} />
        <input type="hidden" name="guests" value={guests} />

        {/*
          The results page keeps this bar pinned, and three stacked segments plus a button is over
          500px — most of a phone screen, sitting on top of the results the guest came to read. So
          on mobile the pinned variant collapses to one row: dates, guests, go. The hero keeps the
          full stack, where there is room for it and it is the only thing on screen.
        */}
        {compact && (
          <div className="card-raised flex items-stretch gap-1 p-1.5 sm:hidden">
            <button type="button" onClick={openDates} data-open={panel === "dates"} className="seg min-h-[50px] flex-1">
              <span className="seg-label flex items-center gap-1.5">
                <CalendarDays size={13} aria-hidden />
                Dates
              </span>
              <span className="seg-value truncate text-[13.5px]" data-empty={!checkIn || !checkOut ? "true" : undefined}>
                {checkIn && checkOut ? `${fmtDay(checkIn)} – ${fmtDay(checkOut)}` : "Add dates"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "guests" ? null : "guests"))}
              data-open={panel === "guests"}
              className="seg min-h-[50px] shrink-0"
              aria-label={`${guests} guests`}
            >
              <span className="seg-label flex items-center gap-1.5">
                <Users size={13} aria-hidden />
                Guests
              </span>
              <span className="seg-value">{guests}</span>
            </button>
            <button type="submit" disabled={!ready} aria-label="Search" className="btn btn-brand shrink-0 px-4">
              <Search size={17} aria-hidden />
            </button>
          </div>
        )}

        <div
          className={`card-raised items-stretch gap-1 p-2 sm:grid sm:grid-cols-[1fr_1fr_minmax(9rem,0.8fr)_auto] ${
            compact ? "hidden sm:p-1.5" : "grid grid-cols-1"
          }`}
        >
          <Segment
            label="Check in"
            value={checkIn ? fmtDay(checkIn) : "Add date"}
            empty={!checkIn}
            open={panel === "dates"}
            icon={<CalendarDays size={15} aria-hidden />}
            onClick={openDates}
          />

          {/* Hairline between segments on desktop only; on mobile they stack and read as rows. */}
          <div className="relative">
            <span
              className="absolute -left-0.5 top-1/2 hidden h-7 w-px -translate-y-1/2 sm:block"
              style={{ backgroundColor: "hsl(var(--line))" }}
              aria-hidden
            />
            <Segment
              label="Check out"
              value={checkOut ? fmtDay(checkOut) : "Add date"}
              empty={!checkOut}
              open={panel === "dates"}
              icon={<CalendarDays size={15} aria-hidden />}
              onClick={openDates}
            />
          </div>

          <div className="relative">
            <span
              className="absolute -left-0.5 top-1/2 hidden h-7 w-px -translate-y-1/2 sm:block"
              style={{ backgroundColor: "hsl(var(--line))" }}
              aria-hidden
            />
            <Segment
              label="Guests"
              value={`${guests} ${guests === 1 ? "guest" : "guests"}`}
              open={panel === "guests"}
              icon={<Users size={15} aria-hidden />}
              onClick={() => setPanel((p) => (p === "guests" ? null : "guests"))}
            />
          </div>

          <div className="sm:p-1">
            <button
              type="submit"
              disabled={!ready}
              className="btn btn-brand h-full w-full px-7 sm:min-w-[8.5rem]"
            >
              <Search size={17} aria-hidden />
              <span>Search</span>
            </button>
          </div>
        </div>
      </form>

      {!compact && (
        <p
          className="mt-3 text-center text-[13px] sm:text-left"
          style={{ color: onDark ? "hsl(var(--brand-ink) / 0.8)" : "hsl(var(--ink-faint))" }}
        >
          {ready ? (
            <>
              {nights} {nights === 1 ? "night" : "nights"} · prices shown include every tax and fee
            </>
          ) : (
            <>Choose your dates to see live availability and the final price.</>
          )}
        </p>
      )}

      {panel !== null && <Backdrop onClose={close} />}

      {panel === "dates" && (
        <Sheet title="Your dates" onClose={close}>
          <DateRangePanel checkIn={checkIn} checkOut={checkOut} onSelect={onSelect} onDone={close} />
        </Sheet>
      )}

      {panel === "guests" && (
        <Sheet title="Guests" onClose={close} align="right">
          <GuestPanel guests={guests} onChange={setGuests} onDone={close} />
        </Sheet>
      )}
    </div>
  );
}

function Segment({
  label, value, empty, open, icon, onClick,
}: {
  label: string;
  value: string;
  empty?: boolean;
  open: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} data-open={open} className="seg w-full" aria-expanded={open}>
      <span className="seg-label flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="seg-value" data-empty={empty ? "true" : undefined}>
        {value}
      </span>
    </button>
  );
}

/** Mobile only — a tap outside the sheet closes it, and the dimmed page says the sheet is modal. */
function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 sm:hidden"
      style={{ backgroundColor: "hsl(var(--ink) / 0.4)" }}
      onClick={onClose}
      aria-hidden
    />
  );
}

/** One shell, two shapes: a bottom sheet under 640px, a popover above it. */
function Sheet({
  title, children, onClose, align = "left",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  align?: "left" | "right";
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`pop pop-in fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-b-none sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-[calc(100%+10px)] sm:max-h-none sm:overflow-visible sm:rounded-[var(--r-lg)] ${
        align === "right" ? "sm:right-0" : "sm:left-0"
      }`}
    >
      {/* The grab handle only exists in sheet form — it is the affordance that says "drag me away". */}
      <div className="flex items-center justify-between px-4 pt-3 sm:hidden">
        <span className="text-[13px] font-bold">{title}</span>
        <button type="button" onClick={onClose} className="btn btn-ghost min-h-[36px] px-3 text-[13px]">
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

function GuestPanel({
  guests, onChange, onDone,
}: {
  guests: number;
  onChange: (n: number) => void;
  onDone: () => void;
}) {
  return (
    <div className="w-full p-4 sm:w-[19rem] sm:p-5">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-[14.5px] font-semibold">Guests</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
            Everyone staying in the room
          </p>
        </div>
        {/* A stepper, not a dropdown: adjusting by one is the only thing anyone ever does here, and
            it takes one tap instead of open-scan-select. */}
        <div className="flex items-center gap-1">
          <StepButton label="One fewer guest" disabled={guests <= 1} onClick={() => onChange(guests - 1)}>
            <Minus size={16} aria-hidden />
          </StepButton>
          <span className="nums w-9 text-center text-[17px] font-bold" aria-live="polite">
            {guests}
          </span>
          <StepButton label="One more guest" disabled={guests >= MAX_GUESTS} onClick={() => onChange(guests + 1)}>
            <Plus size={16} aria-hidden />
          </StepButton>
        </div>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
        We only show rooms that genuinely sleep this many — nothing you would have to argue about at
        the front desk.
      </p>

      <button type="button" onClick={onDone} className="btn btn-brand mt-4 w-full">
        Done
      </button>
    </div>
  );
}

function StepButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="btn btn-outline h-11 w-11 min-h-0 rounded-full p-0"
    >
      {children}
    </button>
  );
}
