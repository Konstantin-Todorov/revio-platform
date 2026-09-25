"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rates as ratesDict } from "@/lib/i18n/rates";

import { useActionState, useEffect, useState } from "react";
import { Card, CardHeader } from "@revio/ui/primitives";
import { saveRatePlan, type ActionResult } from "@/lib/actions-rates";
import { Field, inputCls } from "@/components/ui/Modal";
import { SaveFooter } from "./RoomTypeForm";

export type RatePlanValues = {
  id: string; name: string; code: string; tags: string[]; active: boolean; directChannelEnabled: boolean;
  defMinLos: number | null; defMaxLos: number | null;
  defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null;
};

/** Name, code, tags and where it is sold — one set of fields for the "Add" dialog and the plan's page. */
export function RatePlanBasicsFields({ ratePlan }: { ratePlan?: RatePlanValues }) {
  const f = translate(ratesDict, useLocale()).planForm;
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={f.name}><input name="name" defaultValue={ratePlan?.name} required className={inputCls} placeholder={f.namePlaceholder} /></Field>
        <Field label={f.code}><input name="code" defaultValue={ratePlan?.code} required className={inputCls} placeholder={f.codePlaceholder} /></Field>
      </div>
      <Field label={f.tags} hint={f.tagsHint}>
        <input name="tags" defaultValue={ratePlan?.tags.join(", ")} className={inputCls} placeholder={f.tagsPlaceholder} />
      </Field>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
          <input type="checkbox" name="active" defaultChecked={ratePlan?.active ?? true} className="h-4 w-4 cursor-pointer rounded border-surface-border text-brand-600" /> {f.active}
        </label>
        {/* Switching this off is how a corporate or tour-operator rate stays off the hotel's own
            public page while still going to the OTAs it was negotiated for. */}
        <label className="flex items-start gap-2 text-[13px] font-medium text-ink-700">
          <input
            type="checkbox"
            name="directChannelEnabled"
            defaultChecked={ratePlan?.directChannelEnabled ?? true}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-surface-border text-brand-600"
          />
          <span>
            {f.direct}
            <span className="block text-[11.5px] font-normal text-ink-400">
              {f.directHint}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/** Rate-plan-level restrictions, used on every date that has no rule of its own. Blank = no rule. */
export function RatePlanDefaultsFields({ ratePlan }: { ratePlan?: RatePlanValues }) {
  const f = translate(ratesDict, useLocale()).planForm;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.minStay} hint={f.allDates}>
          <input name="defMinLos" type="number" min={0} defaultValue={ratePlan?.defMinLos ?? ""} className={inputCls} placeholder="—" />
        </Field>
        <Field label={f.maxStay} hint={f.allDates}>
          <input name="defMaxLos" type="number" min={0} defaultValue={ratePlan?.defMaxLos ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.bookAtLeast} hint={f.bookAtLeastHint}>
          <input name="defAdvancePurchaseMin" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMin ?? ""} className={inputCls} placeholder="—" />
        </Field>
        <Field label={f.bookAtMost} hint={f.bookAtMostHint}>
          <input name="defAdvancePurchaseMax" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMax ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
    </div>
  );
}

/**
 * The plan and its defaults — one card, one save at its end, on the plan's own page. `saveRatePlan`
 * writes both at once. It posts no `priceLogic`, so saving here never touches where the price comes
 * from; that has its own tab with its own guardrails.
 */
export function RatePlanEditor({ ratePlan }: { ratePlan: RatePlanValues }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRatePlan, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);
  const f = translate(ratesDict, useLocale()).planForm;

  return (
    <form action={formAction} onChange={() => setSavedAt(null)}>
      <input type="hidden" name="id" value={ratePlan.id} />
      <Card>
        <CardHeader title={f.planTitle} subtitle={f.planSubtitle} />
        <div className="px-5 pb-5"><RatePlanBasicsFields ratePlan={ratePlan} /></div>
        <div className="border-t border-surface-border/70 px-5 py-4">
          <h3 className="text-[13.5px] font-bold text-ink-900">{f.defaultsTitle}</h3>
          <p className="mb-3 text-[11.5px] text-ink-400">{f.defaultsSubtitle}</p>
          <RatePlanDefaultsFields ratePlan={ratePlan} />
        </div>
        <SaveFooter pending={pending} error={state?.error} saved={!!savedAt && !state?.error} />
      </Card>
    </form>
  );
}
