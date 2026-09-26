"use client";

import { useActionState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { welcomeStrings } from "@revio/ui/welcome-strings";
import { welcome } from "@/lib/i18n/welcome";
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

/** The shared frame's words and this product's form words, in the reader's language. */
function useWords() {
  const locale = useLocale();
  return { shell: translate(welcomeStrings, locale).shell, f: translate(welcome, locale).forms };
}

export function PropertyForm({ values }: { values: PropertyFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeProperty, null);
  const { shell } = useWords();

  return (
    <form action={action} className="space-y-6">
      <PropertyFields values={values} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label={shell.saveAndContinue} savingLabel={shell.saving} pending={pending} />
    </form>
  );
}

export function RoomTypeForm() {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(addWelcomeRoomType, null);
  const { f } = useWords();

  return (
    <form action={action} className="space-y-4 rounded-lg border border-surface-border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem_7rem]">
        <label className="block">
          <span className={welcomeLabel}>{f.roomType}</span>
          <input name="name" required placeholder={f.roomTypePlaceholder} className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>{f.howMany}</span>
          <input name="totalRooms" type="number" min={1} required placeholder="10" className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>{f.sleeps}</span>
          <input name="maxGuests" type="number" min={1} defaultValue={2} required className={welcomeInput} />
        </label>
      </div>
      <WelcomeError message={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md border border-surface-border bg-white px-4 text-[13.5px] font-semibold text-ink-800 transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? f.adding : f.addRoomType}
      </button>
    </form>
  );
}

/** The one money field in the flow — empty by default, never prefilled. */
export function PriceForm({ currency, roomTypeCount }: { currency: string; roomTypeCount: number }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(setWelcomePrice, null);
  const { shell, f } = useWords();

  return (
    <form action={action} className="space-y-4">
      <label className="block sm:max-w-[16rem]">
        <span className={welcomeLabel}>{f.nightly(currency)}</span>
        <input name="price" inputMode="decimal" required placeholder={f.nightlyPlaceholder} className={welcomeInput} autoFocus />
      </label>
      <p className="text-[12.5px] text-ink-500">
        {f.appliedTo(roomTypeCount)}
      </p>
      <WelcomeError message={state?.error} />
      <div className="pt-1">
        <WelcomeContinue label={f.setPrice} savingLabel={shell.saving} pending={pending} />
      </div>
    </form>
  );
}

/** Everything that makes an invoice correct — VAT, city tax, and who issues the document. */
export function TaxForm({ values }: { values: TaxFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeTaxes, null);
  const { shell } = useWords();

  return (
    <form action={action} className="space-y-6">
      <TaxFields values={values} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label={shell.saveAndContinue} savingLabel={shell.saving} pending={pending} />
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
  const { shell, f } = useWords();

  return (
    <form action={action} className="space-y-5">
      <BrandFields {...props} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label={f.useThis} savingLabel={shell.saving} pending={pending} />
    </form>
  );
}
