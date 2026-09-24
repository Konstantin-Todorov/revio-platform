"use client";

import { useActionState } from "react";
import { WelcomeContinue } from "@revio/ui/welcome-shell";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { welcomeStrings } from "@revio/ui/welcome-strings";
import { welcome } from "@/lib/i18n/welcome";
import {
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
  addWelcomeUnits,
  saveWelcomeProperty,
  saveWelcomeTaxes,
  type WelcomeResult,
} from "@/lib/actions-welcome";

/** The shared frame's words and this product's own, in the reader's language. */
function useWelcomeText() {
  const locale = useLocale();
  return { shell: translate(welcomeStrings, locale).shell, t: translate(welcome, locale).forms };
}

/**
 * RevioPMS's first-run forms.
 *
 * No price and no branding: the PMS sells nothing and shows a guest nothing. What it has that the
 * others do not is `UnitsForm` — the physical rooms.
 */

export function PropertyForm({ values }: { values: PropertyFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeProperty, null);
  const { shell } = useWelcomeText();

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
  const { t } = useWelcomeText();

  return (
    <form action={action} className="space-y-4 rounded-lg border border-surface-border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem_7rem]">
        <label className="block">
          <span className={welcomeLabel}>{t.roomType}</span>
          <input name="name" required placeholder={t.roomTypePlaceholder} className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>{t.howMany}</span>
          <input name="totalRooms" type="number" min={1} required placeholder="10" className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>{t.sleeps}</span>
          <input name="maxGuests" type="number" min={1} defaultValue={2} required className={welcomeInput} />
        </label>
      </div>
      <WelcomeError message={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md border border-surface-border bg-white px-4 text-[13.5px] font-semibold text-ink-800 transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? t.adding : t.addRoomType}
      </button>
    </form>
  );
}

/**
 * The doors, added a floor at a time.
 *
 * A 40-room hotel typing forty labels one by one is where somebody abandons setup — so this takes a
 * range and generates it. Everything about a room beyond its number (features, connecting rooms) is
 * edited later on the Rooms screen, which is the screen that owns it.
 */
export function UnitsForm({ roomTypes }: { roomTypes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(addWelcomeUnits, null);
  const { t } = useWelcomeText();

  return (
    <form action={action} className="space-y-4 rounded-lg border border-surface-border bg-white p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={welcomeLabel}>{t.roomType}</span>
          <select name="roomTypeId" required className={welcomeInput}>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={welcomeLabel}>{t.floor}</span>
          <input name="floor" placeholder="1" className={welcomeInput} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={welcomeLabel}>{t.startAt}</span>
          <input name="from" type="number" min={0} required placeholder="101" className={welcomeInput} />
        </label>
        <label className="block">
          <span className={welcomeLabel}>{t.howManyRooms}</span>
          <input name="count" type="number" min={1} max={200} required placeholder="10" className={welcomeInput} />
        </label>
      </div>

      <p className="text-[12px] text-ink-400">
        {t.rangeHint}
      </p>

      <WelcomeError message={state?.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md border border-surface-border bg-white px-4 text-[13.5px] font-semibold text-ink-800 transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? t.adding : t.addRooms}
      </button>
    </form>
  );
}

/** Everything that makes an invoice correct — VAT, city tax, and who issues the document. */
export function TaxForm({ values }: { values: TaxFieldValues }) {
  const [state, action, pending] = useActionState<WelcomeResult | null, FormData>(saveWelcomeTaxes, null);
  const { shell } = useWelcomeText();

  return (
    <form action={action} className="space-y-6">
      <TaxFields values={values} />
      <WelcomeError message={state?.error} />
      <WelcomeContinue label={shell.saveAndContinue} savingLabel={shell.saving} pending={pending} />
    </form>
  );
}
