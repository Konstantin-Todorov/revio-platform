"use client";

import { useActionState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import {
  BrandFields,
  PropertyFields,
  WelcomeError,
  welcomeInput,
  welcomeLabel,
  type PropertyFieldValues,
} from "@revio/ui/welcome-fields";
import {
  addWelcomeRoomType,
  saveWelcomeBrand,
  saveWelcomeDelivery,
  saveWelcomeProperty,
  setWelcomePrice,
  type WelcomeResult,
} from "@/lib/actions-welcome";

/**
 * RevioLink's first-run forms.
 *
 * Each is a thin wrapper: the fields come from `@revio/ui/welcome-fields` (the questions are platform
 * facts, identical in all three products) and the action is this app's own (the write is not).
 */

/** Step 1 — mostly prefilled; they are confirming and completing, not filling in a blank form. */
export function PropertyForm({ values }: { values: PropertyFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeProperty, null);

  return (
    <form action={action} className="space-y-6">
      <PropertyFields values={values} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label="Save and continue" pending={pending} />
    </form>
  );
}

/** Step 2 — add room types one at a time; the list above is the running total. */
export function RoomTypeForm() {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(addWelcomeRoomType, null);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-surface-border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem_7rem]">
        <label className="block">
          <span className={welcomeLabel}>Room type</span>
          <input name="name" required placeholder="Double Room" className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>How many</span>
          <input name="totalRooms" type="number" min={1} required placeholder="10" className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>Sleeps</span>
          <input name="maxGuests" type="number" min={1} defaultValue={2} required className={welcomeInput} />
        </label>
      </div>
      <WelcomeError message={state?.error} />
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
        <span className={welcomeLabel}>Nightly price ({currency})</span>
        <input name="price" inputMode="decimal" required placeholder="e.g. 120" className={welcomeInput} autoFocus />
      </label>
      <p className="text-[12.5px] text-ink-500">
        Applied to {roomTypeCount === 1 ? "your room type" : `all ${roomTypeCount} room types`} for the next
        180 nights. You can change any date afterwards on the calendar.
      </p>
      <WelcomeError message={state?.error} />
      <div className="pt-1">
        <WelcomeContinue label="Set this price" pending={pending} />
      </div>
    </form>
  );
}

/** The personalisation step — the only screen in first-run that gives something back. */
export function BrandForm(props: {
  propertyName: string;
  senderName: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeBrand, null);

  return (
    <form action={action} className="space-y-5">
      <BrandFields {...props} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label="Use this" pending={pending} />
    </form>
  );
}

/**
 * Where channel bookings land — RevioLink's own question, and only when it runs alone.
 *
 * The contact email is offered as the default because it is usually the right answer and they have
 * just typed it two screens ago; it is still a real field they can change, not a silent assumption.
 */
export function DeliveryForm({ suggested }: { suggested: string | null }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeDelivery, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className={welcomeLabel}>Send bookings to</span>
        <input
          name="reservationEmailPrimary"
          type="email"
          required
          defaultValue={suggested ?? ""}
          placeholder="reception@yourhotel.com"
          className={welcomeInput}
        />
      </label>

      <label className="block">
        <span className={welcomeLabel}>And also to (optional)</span>
        <input
          name="reservationEmailSecondary"
          type="email"
          placeholder="owner@yourhotel.com"
          className={welcomeInput}
        />
      </label>

      <label className="flex items-start gap-2.5 rounded-md border border-surface-border bg-white px-4 py-3">
        <input type="checkbox" name="notifyTomorrowArrivals" defaultChecked className="mt-0.5 h-4 w-4" />
        <span className="text-[13px] leading-relaxed text-ink-700">
          Email tomorrow&rsquo;s arrivals each evening
          <span className="mt-0.5 block text-[12px] text-ink-400">
            A list the evening before is something reception can act on.
          </span>
        </span>
      </label>

      <WelcomeError message={state?.error} />
      <div className="pt-1">
        <WelcomeContinue label="Save and continue" pending={pending} />
      </div>
    </form>
  );
}
