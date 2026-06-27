"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ArrowLeftRight } from "lucide-react";
import { savePropertySettings, type ActionResult } from "@/lib/actions-config";
import { Field, inputCls } from "@/components/ui/Modal";

type Property = {
  name: string; timezone: string; baseCurrency: string; syncHorizonDays: number;
  checkInTime: string; checkOutTime: string; contactEmail: string | null; phone: string | null;
};

const CURRENCIES = ["EUR", "USD", "GBP", "BGN"];

export function PropertySettingsForm({ property }: { property: Property }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertySettings, null);
  const [currency, setCurrency] = useState(property.baseCurrency);
  const currencyChanged = currency !== property.baseCurrency;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Property name"><input name="name" defaultValue={property.name} required className={inputCls} /></Field>
        <Field label="Time zone"><input name="timezone" defaultValue={property.timezone} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Base currency" hint="Channels inherit this">
          <select name="baseCurrency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Sync horizon (days)" hint="How far ahead to push"><input name="syncHorizonDays" type="number" min={1} defaultValue={property.syncHorizonDays} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Check-in"><input name="checkInTime" defaultValue={property.checkInTime} className={inputCls} /></Field>
          <Field label="Check-out"><input name="checkOutTime" defaultValue={property.checkOutTime} className={inputCls} /></Field>
        </div>
      </div>

      {/* Currency-change prompt: convert all existing rates, or just change the displayed currency. */}
      {currencyChanged && (
        <div className="space-y-2.5 rounded-md border border-warning-200 bg-warning-50 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
            <ArrowLeftRight className="h-4 w-4 text-warning-600" />
            Changing currency to {currency} — would you like to convert all existing rates?
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="radio" name="convertRates" value="false" defaultChecked className="h-4 w-4" />
            No — only change the displayed currency (every rate value stays the same)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="radio" name="convertRates" value="true" className="h-4 w-4" />
            Yes — convert every rate at this exchange rate:
          </label>
          <input
            name="conversionRate" type="number" step="0.0001" min="0"
            placeholder={`1 ${property.baseCurrency} = ?  ${currency}`}
            className={`${inputCls} max-w-[220px]`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={property.contactEmail ?? ""} className={inputCls} /></Field>
        <Field label="Phone"><input name="phone" defaultValue={property.phone ?? ""} className={inputCls} /></Field>
      </div>

      {state?.ok && (
        <div className="flex items-center gap-2 rounded-md bg-success-50 px-3 py-2.5 text-[13px] font-semibold text-success-600">
          <CheckCircle2 className="h-4 w-4" /> Settings saved.
        </div>
      )}
      {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
