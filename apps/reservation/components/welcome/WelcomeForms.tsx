"use client";

import { useActionState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import {
  BrandFields,
  PropertyFields,
  TaxFields,
  WelcomeError,
  welcomeInput,
  welcomeLabel,
  type PropertyFieldValues,
  type TaxFieldValues,
} from "@revio/ui/welcome-fields";
import {
  addWelcomeRoomType,
  saveWelcomeBrand,
  saveWelcomeProperty,
  saveWelcomeTaxes,
  setWelcomePrice,
  type WelcomeResult,
} from "@/lib/actions-welcome";

/**
 * RevioCRS's first-run forms.
 *
 * Thin wrappers: the fields come from `@revio/ui/welcome-fields` (the questions are platform facts,
 * identical in all three products) and the action is this app's own (the write is not).
 */

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

/** The one money field in the flow — empty by default, never prefilled. */
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
        180 nights. Availability search can quote a stay as soon as this exists.
      </p>
      <WelcomeError message={state?.error} />
      <div className="pt-1">
        <WelcomeContinue label="Set this price" pending={pending} />
      </div>
    </form>
  );
}

/** Everything that makes an invoice correct — VAT, city tax, and who issues the document. */
export function TaxForm({ values }: { values: TaxFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeTaxes, null);

  return (
    <form action={action} className="space-y-6">
      <TaxFields values={values} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label="Save and continue" pending={pending} />
    </form>
  );
}

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
