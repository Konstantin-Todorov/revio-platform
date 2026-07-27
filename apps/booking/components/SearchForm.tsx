"use client";

import { useState } from "react";

/**
 * The search bar. Three inputs and nothing else — dates, guests, go.
 *
 * A plain GET form on purpose: the result is a shareable, back-button-safe URL, it works before
 * hydration, and it needs no client state. The only JavaScript here keeps check-out ahead of
 * check-in, which is a correctness guard, not a flourish.
 */

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function SearchForm({
  slug,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests = 2,
  maxGuests = 8,
}: {
  slug: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  maxGuests?: number;
}) {
  const today = iso(new Date());
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? iso(new Date(Date.now() + DAY)));
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? iso(new Date(Date.now() + 3 * DAY)));

  // Choosing an arrival after your departure is a mistake, not an intention — fix it silently
  // rather than rejecting the form later.
  function onCheckIn(value: string) {
    setCheckIn(value);
    if (value >= checkOut) setCheckOut(iso(new Date(new Date(`${value}T00:00:00Z`).getTime() + DAY)));
  }

  const nights = Math.max(
    0,
    Math.round((new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / DAY),
  );

  return (
    <form action={`/${slug}/search`} method="GET" className="card rounded-xl p-1.5 sm:p-2">
      <div className="grid grid-cols-1 divide-y divide-[hsl(var(--rule))] sm:grid-cols-[1fr_1fr_auto_auto] sm:divide-x sm:divide-y-0">
        <label className="group cursor-pointer px-4 py-3">
          <span className="eyebrow block">Check in</span>
          <input
            type="date"
            name="checkIn"
            value={checkIn}
            min={today}
            onChange={(e) => onCheckIn(e.target.value)}
            required
            className="field mt-1 w-full border-0 bg-transparent p-0 text-[15px] font-medium outline-none"
          />
        </label>

        <label className="group cursor-pointer px-4 py-3">
          <span className="eyebrow block">Check out</span>
          <input
            type="date"
            name="checkOut"
            value={checkOut}
            min={iso(new Date(new Date(`${checkIn}T00:00:00Z`).getTime() + DAY))}
            onChange={(e) => setCheckOut(e.target.value)}
            required
            className="field mt-1 w-full border-0 bg-transparent p-0 text-[15px] font-medium outline-none"
          />
        </label>

        <label className="cursor-pointer px-4 py-3 sm:w-32">
          <span className="eyebrow block">Guests</span>
          <select
            name="guests"
            defaultValue={String(defaultGuests)}
            className="field mt-1 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-[15px] font-medium outline-none"
          >
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>

        <div className="p-2">
          <button
            type="submit"
            className="btn-brand h-full w-full rounded-lg px-7 py-3.5 text-[14px] font-semibold tracking-wide sm:py-0"
          >
            Search
            {nights > 0 && (
              <span className="ml-2 font-normal opacity-70">
                · {nights} {nights === 1 ? "night" : "nights"}
              </span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
