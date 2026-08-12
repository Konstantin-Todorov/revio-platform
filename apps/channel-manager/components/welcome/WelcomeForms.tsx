"use client";

import { useActionState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import {
  addWelcomeRoomType,
  saveWelcomeProperty,
  setWelcomePrice,
  type WelcomeResult,
} from "@/lib/actions-welcome";

const input =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";
const label = "mb-1 block text-[12.5px] font-semibold text-ink-700";
const err = "rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600";

/** Step 1 — everything prefilled; they are confirming, not filling in a form. */
export function PropertyForm({
  name,
  timezone,
  baseCurrency,
  checkOutTime,
}: {
  name: string;
  timezone: string;
  baseCurrency: string;
  checkOutTime: string;
}) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeProperty, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className={label}>Property name</span>
        <input name="name" defaultValue={name} required className={input} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Currency</span>
          <select name="baseCurrency" defaultValue={baseCurrency} className={input}>
            <option value="EUR">EUR — Euro</option>
            <option value="BGN">BGN — Bulgarian lev</option>
            <option value="USD">USD — US dollar</option>
            <option value="GBP">GBP — Pound sterling</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Time zone</span>
          <select name="timezone" defaultValue={timezone} className={input}>
            <option value="Europe/Sofia">Europe/Sofia</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Athens">Europe/Athens</option>
            <option value="Europe/Bucharest">Europe/Bucharest</option>
          </select>
        </label>
      </div>

      <label className="block sm:max-w-[12rem]">
        <span className={label}>Check-out time</span>
        <input name="checkOutTime" type="time" defaultValue={checkOutTime} className={input} />
      </label>

      {state?.error && <p className={err}>{state.error}</p>}
      <div className="pt-2">
        <WelcomeContinue label="That's right — continue" pending={pending} />
      </div>
    </form>
  );
}

/** Step 2 — add room types one at a time; the list above is the running total. */
export function RoomTypeForm() {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(addWelcomeRoomType, null);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-surface-border bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem_7rem]">
        <label className="block">
          <span className={label}>Room type</span>
          <input name="name" required placeholder="Double Room" className={input} />
        </label>
        <label className="block">
          <span className={label}>How many</span>
          <input name="totalRooms" type="number" min={1} required placeholder="10" className={input} />
        </label>
        <label className="block">
          <span className={label}>Sleeps</span>
          <input name="maxGuests" type="number" min={1} defaultValue={2} required className={input} />
        </label>
      </div>
      {state?.error && <p className={err}>{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md border border-surface-border bg-white px-4 text-[13.5px] font-semibold text-ink-800 transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add room type"}
      </button>
    </form>
  );
}

/**
 * Step 3 — one price. Empty by default, deliberately.
 *
 * A prefilled rate is the one default that costs the hotel money: most people never change a
 * default, and this one is their revenue.
 */
export function PriceForm({ currency, roomTypeCount }: { currency: string; roomTypeCount: number }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(setWelcomePrice, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block sm:max-w-[16rem]">
        <span className={label}>Nightly price ({currency})</span>
        <input
          name="price"
          inputMode="decimal"
          required
          placeholder="e.g. 120"
          className={input}
          autoFocus
        />
      </label>
      <p className="text-[12.5px] text-ink-500">
        Applied to {roomTypeCount === 1 ? "your room type" : `all ${roomTypeCount} room types`} for the next
        180 nights. You can change any date afterwards on the calendar.
      </p>
      {state?.error && <p className={err}>{state.error}</p>}
      <div className="pt-1">
        <WelcomeContinue label="Set this price" pending={pending} />
      </div>
    </form>
  );
}
