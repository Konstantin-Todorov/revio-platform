"use client";

import { useActionState, useState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import {
  addWelcomeRoomType,
  saveWelcomeBrand,
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

/**
 * The personalisation step. The only screen in first-run that gives something back.
 *
 * A live preview rather than a form: the point of asking is that they see the result, which is also
 * why this is the step most likely to be finished rather than skipped.
 */
export function BrandForm({
  propertyName,
  senderName,
  brandColor,
  logoUrl,
}: {
  propertyName: string;
  senderName: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeBrand, null);
  const [colour, setColour] = useState(brandColor ?? "#0E7C86");
  const [name, setName] = useState(senderName ?? propertyName);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Sender name</span>
          <input
            name="emailSenderName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder={propertyName}
          />
          <span className="mt-1 block text-[12px] text-ink-400">Who guest emails appear to come from.</span>
        </label>

        <label className="block">
          <span className={label}>Your colour</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-surface-border bg-white p-1"
              aria-label="Brand colour"
            />
            <input
              name="emailBrandColor"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className={input}
            />
          </span>
        </label>
      </div>

      <label className="block">
        <span className={label}>Logo link (optional)</span>
        <input name="emailLogoUrl" defaultValue={logoUrl ?? ""} className={input} placeholder="https://…" />
        <span className="mt-1 block text-[12px] text-ink-400">
          You can upload one later in Settings — a link is quicker if you already have it online.
        </span>
      </label>

      {/* What they are actually buying with this screen. */}
      <div className="overflow-hidden rounded-lg border border-surface-border bg-white">
        <div className="border-b border-surface-border px-4 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-400">
          Preview
        </div>
        <div className="p-5">
          <div className="text-[13px] font-bold" style={{ color: colour }}>
            {name || propertyName}
          </div>
          <p className="mt-2 text-[13px] text-ink-700">Dear Elena, your booking is confirmed.</p>
          <span
            className="mt-3 inline-block rounded-md px-3.5 py-2 text-[12.5px] font-semibold text-white"
            style={{ backgroundColor: colour }}
          >
            View your booking
          </span>
          <p className="mt-4 text-[11.5px] text-ink-400">
            The same colour is used on your own booking page unless you change it there.
          </p>
        </div>
      </div>

      {state?.error && <p className={err}>{state.error}</p>}
      <WelcomeContinue label="Use this" pending={pending} />
    </form>
  );
}
