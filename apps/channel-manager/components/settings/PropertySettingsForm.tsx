"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ArrowLeftRight } from "lucide-react";
import { savePropertySettings, type ActionResult } from "@/lib/actions-config";
import { Field, inputCls } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { settings as settingsDict } from "@/lib/i18n/settings";

type Property = {
  name: string; timezone: string; baseCurrency: string; syncHorizonDays: number;
  checkInTime: string; checkOutTime: string; contactEmail: string | null; phone: string | null;
};

// No BGN: Bulgaria is on the euro. Old rows still RENDER as лв (see format.ts) — a currency can
// stop being offered long before the last record in it stops existing.
const CURRENCIES = ["EUR", "USD", "GBP"];

export function PropertySettingsForm({ property }: { property: Property }) {
  const s = translate(settingsDict, useLocale()).property;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertySettings, null);
  const [currency, setCurrency] = useState(property.baseCurrency);
  const currencyChanged = currency !== property.baseCurrency;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={s.name}><input name="name" defaultValue={property.name} required className={inputCls} /></Field>
        <Field label={s.timezone}><input name="timezone" defaultValue={property.timezone} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label={s.currency} hint={s.currencyHint}>
          <select name="baseCurrency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={s.horizon} hint={s.horizonHint}><input name="syncHorizonDays" type="number" min={1} defaultValue={property.syncHorizonDays} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={s.checkIn}><input name="checkInTime" defaultValue={property.checkInTime} className={inputCls} /></Field>
          <Field label={s.checkOut}><input name="checkOutTime" defaultValue={property.checkOutTime} className={inputCls} /></Field>
        </div>
      </div>

      {/* Currency-change prompt: convert all existing rates, or just change the displayed currency. */}
      {currencyChanged && (
        <div className="space-y-2.5 rounded-md border border-warning-200 bg-warning-50 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
            <ArrowLeftRight className="h-4 w-4 text-warning-600" />
            {s.convertTitle(currency)}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="radio" name="convertRates" value="false" defaultChecked className="h-4 w-4" />
            {s.convertNo}
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="radio" name="convertRates" value="true" className="h-4 w-4" />
            {s.convertYes}
          </label>
          <input
            name="conversionRate" type="number" step="0.0001" min="0"
            placeholder={`1 ${property.baseCurrency} = ?  ${currency}`}
            className={`${inputCls} max-w-[220px]`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={s.contactEmail}><input name="contactEmail" type="email" defaultValue={property.contactEmail ?? ""} className={inputCls} /></Field>
        <Field label={s.phone}><input name="phone" defaultValue={property.phone ?? ""} className={inputCls} /></Field>
      </div>

      {state?.ok && (
        <div className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2.5 text-[13px] font-semibold text-success-600">
          <CheckCircle2 className="h-4 w-4" /> {s.saved}
        </div>
      )}
      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
        {pending ? s.saving : s.save}
      </button>
    </form>
  );
}
