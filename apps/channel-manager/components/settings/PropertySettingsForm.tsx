"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { savePropertySettings, type ActionResult } from "@/lib/actions-config";
import { Field, inputCls } from "@/components/ui/Modal";

type Property = {
  name: string; timezone: string; baseCurrency: string; syncHorizonDays: number;
  checkInTime: string; checkOutTime: string; contactEmail: string | null; phone: string | null;
};

export function PropertySettingsForm({ property }: { property: Property }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(savePropertySettings, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Property name"><input name="name" defaultValue={property.name} required className={inputCls} /></Field>
        <Field label="Time zone"><input name="timezone" defaultValue={property.timezone} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Base currency">
          <select name="baseCurrency" defaultValue={property.baseCurrency} className={inputCls}>{["EUR", "USD", "GBP", "BGN"].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Sync horizon (days)" hint="How far ahead to push"><input name="syncHorizonDays" type="number" min={1} defaultValue={property.syncHorizonDays} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Check-in"><input name="checkInTime" defaultValue={property.checkInTime} className={inputCls} /></Field>
          <Field label="Check-out"><input name="checkOutTime" defaultValue={property.checkOutTime} className={inputCls} /></Field>
        </div>
      </div>
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
