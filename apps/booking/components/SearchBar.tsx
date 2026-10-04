"use client";

import { useCallback, useState } from "react";
import { CalendarDays, Minus, Plus, Search, Users } from "lucide-react";
import { DateRangePanel } from "./DateRangePanel";
import { useDismiss } from "@/lib/use-dismiss";
import { addDays, isValidISO, nightsBetween, todayISO } from "@/lib/dates";
import { useGuestKit } from "@/lib/i18n/use-kit";
import type { GuestKit } from "@/lib/i18n/kit";

/**
 * The stay in as few characters as a phone bar can hold — "28–30 Sept", or "28 Sept – 2 Oct" across a
 * month. The weekday-and-all form truncated mid-date there; the full dates are on the page below.
 */
function shortRange(fmtDay: GuestKit["fmtDay"], checkIn: string, checkOut: string): string {
  const noWeekday = (iso: string) => fmtDay(iso).replace(/^\S+\s+/, "");
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  return sameMonth ? `${Number(checkIn.slice(8, 10))}–${noWeekday(checkOut)}` : `${noWeekday(checkIn)} – ${noWeekday(checkOut)}`;
}

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
  defaultChildAges = [],
  defaultRooms = [],
  compact = false,
  onDark = false,
}: {
  slug: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  /** Children's ages from the URL (`ages=4,7`). */
  defaultChildAges?: number[];
  /** Several rooms (`rooms=2-5.1|2`) — when present, wins over guests/ages. */
  defaultRooms?: { adults: number; childAges: number[] }[];
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
  /*
   * One entry per room, each with its own adults and children. A child's age is null until the guest
   * picks it — a guessed age misprices silently. One room is still sent as plain `guests`/`ages`, so
   * every link already in an email keeps working.
   */
  const [rooms, setRooms] = useState<RoomState[]>(
    defaultRooms.length > 1 ? defaultRooms.map((r) => ({ adults: r.adults, ages: r.childAges })) : [{ adults: defaultGuests, ages: defaultChildAges }],
  );
  const guests = rooms[0]!.adults;
  const ages = rooms[0]!.ages;
  const [panel, setPanel] = useState<"dates" | "guests" | null>(null);
  const { s: t, fmtDay } = useGuestKit();
  const s = t.bar;

  const close = useCallback(() => setPanel(null), []);
  const ref = useDismiss<HTMLDivElement>(panel !== null, close);

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const agesKnown = rooms.every((r) => r.ages.every((a) => a != null));
  const ready = !!checkIn && !!checkOut && nights > 0 && agesKnown;
  const totalAdults = rooms.reduce((n, r) => n + r.adults, 0);
  const totalKids = rooms.reduce((n, r) => n + r.ages.length, 0);
  const partyLabel = rooms.length > 1 ? s.roomsParty(rooms.length, totalAdults, totalKids) : s.party(guests, ages.length);

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
        {rooms.length > 1 ? (
          <input type="hidden" name="rooms" value={rooms.map((r) => (r.ages.length ? `${r.adults}-${r.ages.join(".")}` : String(r.adults))).join("|")} />
        ) : (
          <>
            <input type="hidden" name="guests" value={guests} />
            {ages.length > 0 && <input type="hidden" name="ages" value={ages.join(",")} />}
          </>
        )}

        {/*
          The results page keeps this bar pinned, and three stacked segments plus a button is over
          500px — most of a phone screen, sitting on top of the results the guest came to read. So
          on mobile the pinned variant collapses to one row: dates, guests, go. The hero keeps the
          full stack, where there is room for it and it is the only thing on screen.
        */}
        {compact && (
          <div className="card-raised flex items-stretch gap-1 p-1.5 sm:hidden">
            {/* ⚠️ `min-w-0`: a flex item will not shrink below its text without it, so "Mon 28 Sept – Wed 30
                Sept" pushed the search button off a 375px screen and the page scrolled sideways. The
                date line truncates instead; the full range is one tap away in the picker. */}
            <button type="button" onClick={openDates} data-open={panel === "dates"} className="seg min-h-[50px] min-w-0 flex-1">
              <span className="seg-label flex items-center gap-1.5">
                <CalendarDays size={13} aria-hidden />
                {s.dates}
              </span>
              <span className="seg-value truncate text-[13.5px]" data-empty={!checkIn || !checkOut ? "true" : undefined}>
                {checkIn && checkOut ? shortRange(fmtDay, checkIn, checkOut) : s.addDates}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "guests" ? null : "guests"))}
              data-open={panel === "guests"}
              className="seg min-h-[50px] shrink-0"
              aria-label={partyLabel}
            >
              <span className="seg-label flex items-center gap-1.5">
                <Users size={13} aria-hidden />
                {s.guests}
              </span>
              <span className="seg-value">{totalAdults + totalKids}</span>
            </button>
            <button type="submit" disabled={!ready} aria-label={s.search} className="btn btn-brand shrink-0 px-4">
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
            label={s.checkIn}
            value={checkIn ? fmtDay(checkIn) : s.addDate}
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
              label={s.checkOut}
              value={checkOut ? fmtDay(checkOut) : s.addDate}
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
              label={s.guests}
              value={partyLabel}
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
              <span>{s.search}</span>
            </button>
          </div>
        </div>
      </form>

      {!compact && (
        <p
          className="mt-3 text-center text-[13px] sm:text-left"
          style={{ color: onDark ? "hsl(var(--brand-ink) / 0.8)" : "hsl(var(--ink-faint))" }}
        >
          {!agesKnown ? <>{s.needAges}</> : ready ? <>{s.ready(nights)}</> : <>{s.empty}</>}
        </p>
      )}

      {panel !== null && <Backdrop onClose={close} />}

      {panel === "dates" && (
        <Sheet title={s.yourDates} closeLabel={s.close} onClose={close}>
          <DateRangePanel checkIn={checkIn} checkOut={checkOut} onSelect={onSelect} onDone={close} prices={agesKnown ? { slug, guests, childAges: ages as number[] } : { slug, guests }} />
        </Sheet>
      )}

      {panel === "guests" && (
        <Sheet title={s.guests} closeLabel={s.close} onClose={close} align="right">
          <GuestPanel rooms={rooms} onRooms={setRooms} onDone={close} s={s} />
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
  title, closeLabel, children, onClose, align = "left",
}: {
  title: string;
  closeLabel: string;
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
          {closeLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

type RoomState = { adults: number; ages: (number | null)[] };

function GuestPanel({
  rooms, onRooms, onDone, s,
}: {
  s: GuestKit["s"]["bar"];
  rooms: RoomState[];
  onRooms: (r: RoomState[]) => void;
  onDone: () => void;
}) {
  const missing = rooms.some((r) => r.ages.some((a) => a == null));
  const setRoom = (i: number, next: RoomState) => onRooms(rooms.map((r, j) => (j === i ? next : r)));
  return (
    <div className="max-h-[70vh] w-full overflow-y-auto p-4 sm:w-[22rem] sm:p-5">
      <Stepper
        label={s.rooms} hint={s.roomsHint} value={rooms.length}
        min={1} max={5} fewer={s.fewerRooms} more={s.moreRooms}
        onChange={(n) => onRooms(n > rooms.length ? [...rooms, { adults: 2, ages: [] }] : rooms.slice(0, n))}
      />
      {rooms.map((room, ri) => (
        <div key={ri} className="mt-4 border-t pt-4" style={{ borderColor: "hsl(var(--line))" }}>
          {rooms.length > 1 && <p className="eyebrow mb-2">{s.roomN(ri + 1)}</p>}
          <Stepper
            label={s.adults} hint={s.adultsHint} value={room.adults}
            min={1} max={MAX_GUESTS} fewer={s.fewer} more={s.more}
            onChange={(n) => setRoom(ri, { ...room, adults: n })}
          />
          <div className="mt-3">
            <Stepper
              label={s.children} hint={s.childrenHint} value={room.ages.length}
              min={0} max={6} fewer={s.fewerChildren} more={s.moreChildren}
              onChange={(n) => setRoom(ri, { ...room, ages: n > room.ages.length ? [...room.ages, null] : room.ages.slice(0, n) })}
            />
          </div>
          {/* Each child's age, as Booking.com asks: the hotel's bands decide who is an infant in a cot,
              who is a child with a bed and who already counts as an adult. */}
          {room.ages.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {room.ages.map((a, i) => (
                <label key={i} className="block">
                  <span className="mb-1 block text-[12px] font-semibold" style={{ color: "hsl(var(--ink-soft))" }}>{s.childAge(i + 1)}</span>
                  <select
                    value={a ?? ""}
                    onChange={(e) => setRoom(ri, { ...room, ages: room.ages.map((x, j) => (j === i ? (e.target.value === "" ? null : Number(e.target.value)) : x)) })}
                    className="h-10 w-full rounded-[var(--r-sm)] border px-2 text-[14px]"
                    style={{ borderColor: a == null ? "hsl(var(--caution))" : "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }}
                  >
                    <option value="">{s.agePick}</option>
                    {Array.from({ length: 18 }, (_, n) => <option key={n} value={n}>{s.ageOption(n)}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: missing ? "hsl(var(--caution))" : "hsl(var(--ink-soft))" }}>
        {missing ? s.needAges : s.guestsNote}
      </p>

      <button type="button" onClick={onDone} disabled={missing} className="btn btn-brand mt-4 w-full">
        {s.done}
      </button>
    </div>
  );
}

function Stepper({
  label, hint, value, min, max, fewer, more, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number; fewer: string; more: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-[14.5px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>{hint}</p>
      </div>
      {/* A stepper, not a dropdown: adjusting by one is the only thing anyone does here. */}
      <div className="flex items-center gap-1">
        <StepButton label={fewer} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus size={16} aria-hidden />
        </StepButton>
        <span className="nums w-9 text-center text-[17px] font-bold" aria-live="polite">{value}</span>
        <StepButton label={more} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus size={16} aria-hidden />
        </StepButton>
      </div>
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
