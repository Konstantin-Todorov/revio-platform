"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { saveDeliverySettings, sendTestEmail, type ActionResult } from "@/lib/actions-config";
import { Field, inputCls } from "@/components/ui/Modal";

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

const TO_OPTIONS = [
  ["primary", "Primary email"],
  ["secondary", "Secondary email"],
  ["both", "Both emails"],
] as const;

/** Reservation delivery + arrival summaries (CM-UPDATES-V1 Settings). */
export function DeliverySettingsForm({ property, emailMode }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveDeliverySettings, null);

  const digestRow = (label: string, name: "notifyToday" | "notifyTomorrow", on: boolean, time: string, to: string) => (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-surface-border px-3 py-2.5">
      <label className="flex min-w-[180px] flex-1 cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-800">
        <input type="checkbox" name={`${name}Arrivals`} defaultChecked={on} className="h-4 w-4 rounded border-surface-border text-brand-600" />
        {label}
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-ink-500">
        send at
        <input type="time" name={`${name}Time`} defaultValue={time} className={`${inputCls} !h-8 !w-auto`} />
      </label>
      <select name={`${name}To`} defaultValue={to} className={`${inputCls} !h-8 !w-auto`}>
        {TO_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Primary reservation email" hint="New channel bookings are emailed here when no PMS/CRS takes delivery">
          <input name="reservationEmailPrimary" type="email" defaultValue={property.reservationEmailPrimary ?? ""} placeholder="frontdesk@hotel.com" className={inputCls} />
        </Field>
        <Field label="Secondary reservation email" hint="Optional copy — e.g. the manager">
          <input name="reservationEmailSecondary" type="email" defaultValue={property.reservationEmailSecondary ?? ""} placeholder="manager@hotel.com" className={inputCls} />
        </Field>
      </div>

      <div className="space-y-2">
        <span className="block text-[12px] font-semibold text-ink-700">Arrival summaries</span>
        {digestRow("Today's arrivals", "notifyToday", property.notifyTodayArrivals, property.notifyTodayTime, property.notifyTodayTo)}
        {digestRow("Tomorrow's arrivals", "notifyTomorrow", property.notifyTomorrowArrivals, property.notifyTomorrowTime, property.notifyTomorrowTo)}
      </div>

      {state?.ok && (
        <p className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-semibold text-success-600">
          <CheckCircle2 className="h-4 w-4" /> Delivery settings saved.
        </p>
      )}
      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-400">
          Email provider: {emailMode === "resend" ? "Resend (live)" : "mock — set RESEND_API_KEY to send real mail"}
        </span>
        <div className="flex gap-2">
          <button
            type="submit"
            formAction={() => sendTestEmail()}
            className="flex items-center gap-1.5 rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
          >
            <Send className="h-3.5 w-3.5" /> Send test email
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Saving…" : "Save delivery settings"}
          </button>
        </div>
      </div>
    </form>
  );
}
