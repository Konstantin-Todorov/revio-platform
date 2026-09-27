"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { saveDeliverySettings, sendTestEmail, type ActionResult } from "@/lib/actions-config";
import { Field, inputCls } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { settings as settingsDict } from "@/lib/i18n/settings";

type Props = {
  property: {
    reservationEmailPrimary: string | null;
    reservationEmailSecondary: string | null;
    notifyTodayArrivals: boolean;
    notifyTodayTime: string;
    notifyTodayTo: string;
    notifyTomorrowArrivals: boolean;
    notifyTomorrowTime: string;
    notifyTomorrowTo: string;
  };
  emailMode: "resend" | "mock";
};

const TO_OPTIONS = ["primary", "secondary", "both"] as const;

/** Reservation delivery + arrival summaries (CM-UPDATES-V1 Settings). */
export function DeliverySettingsForm({ property, emailMode }: Props) {
  const s = translate(settingsDict, useLocale()).delivery;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveDeliverySettings, null);

  const digestRow = (label: string, name: "notifyToday" | "notifyTomorrow", on: boolean, time: string, to: string) => (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-surface-border px-3 py-2.5">
      <label className="flex min-w-[180px] flex-1 cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-800">
        <input type="checkbox" name={`${name}Arrivals`} defaultChecked={on} className="h-4 w-4 rounded border-surface-border text-brand-600" />
        {label}
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-500">
        {s.sendAt}
        <input type="time" name={`${name}Time`} defaultValue={time} className={`${inputCls} !h-8 !w-auto`} />
      </label>
      <select name={`${name}To`} defaultValue={to} className={`${inputCls} !h-8 !w-auto`}>
        {TO_OPTIONS.map((v) => <option key={v} value={v}>{s.to[v]}</option>)}
      </select>
    </div>
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={s.primary} hint={s.primaryHint}>
          <input name="reservationEmailPrimary" type="email" defaultValue={property.reservationEmailPrimary ?? ""} placeholder="frontdesk@hotel.com" className={inputCls} />
        </Field>
        <Field label={s.secondary} hint={s.secondaryHint}>
          <input name="reservationEmailSecondary" type="email" defaultValue={property.reservationEmailSecondary ?? ""} placeholder="manager@hotel.com" className={inputCls} />
        </Field>
      </div>

      <div className="space-y-2">
        <span className="block text-[12px] font-semibold text-ink-700">{s.summaries}</span>
        {digestRow(s.today, "notifyToday", property.notifyTodayArrivals, property.notifyTodayTime, property.notifyTodayTo)}
        {digestRow(s.tomorrow, "notifyTomorrow", property.notifyTomorrowArrivals, property.notifyTomorrowTime, property.notifyTomorrowTo)}
      </div>

      {state?.ok && (
        <p className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-semibold text-success-600">
          <CheckCircle2 className="h-4 w-4" /> {s.saved}
        </p>
      )}
      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* The state, not the remedy. A hotel cannot act on the name of our environment variable —
            but it must know when its guest mail is not actually leaving, so this never softens. */}
        <span className="text-[11.5px] text-ink-400">
          {emailMode === "resend"
            ? s.connected
            : s.notConnected}
        </span>
        <div className="flex gap-2">
          <button
            type="submit"
            formAction={() => sendTestEmail()}
            className="flex items-center gap-1.5 rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
          >
            <Send className="h-3.5 w-3.5" /> {s.test}
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
            {pending ? s.saving : s.save}
          </button>
        </div>
      </div>
    </form>
  );
}
