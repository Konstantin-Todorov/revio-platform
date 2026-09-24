"use client";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Card, CardHeader } from "@revio/ui/primitives";
import { saveRatePlan, type ActionResult } from "@/lib/actions-rates";
import { Field, inputCls } from "@/components/ui/Modal";

export type RatePlanValues = {
  id: string; name: string; code: string; tags: string[]; active: boolean; directChannelEnabled: boolean;
  defMinLos: number | null; defMaxLos: number | null;
  defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null;
};

/** Name, code, tags and where it is sold — one set of fields for the "Add" dialog and the plan's page. */
export function RatePlanBasicsFields({ ratePlan }: { ratePlan?: RatePlanValues }) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" defaultValue={ratePlan?.name} required className={inputCls} placeholder="Non Refundable" /></Field>
        <Field label="Code"><input name="code" defaultValue={ratePlan?.code} required className={inputCls} placeholder="NR" /></Field>
      </div>
      <Field label="Tags" hint="Comma-separated, e.g. breakfast, non-refundable">
        <input name="tags" defaultValue={ratePlan?.tags.join(", ")} className={inputCls} placeholder="breakfast, BB" />
      </Field>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
          <input type="checkbox" name="active" defaultChecked={ratePlan?.active ?? true} className="h-4 w-4 cursor-pointer rounded border-surface-border text-brand-600" /> Active
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
            Sell on our own booking page
            <span className="block text-[11.5px] font-normal text-ink-400">
              Off for rates that belong to a specific partner — corporate, tour operator, an OTA-only promotion.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/** Rate-plan-level restrictions, used on every date that has no rule of its own. Blank = no rule. */
export function RatePlanDefaultsFields({ ratePlan }: { ratePlan?: RatePlanValues }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minimum stay (nights)" hint="Applies to all dates">
          <input name="defMinLos" type="number" min={0} defaultValue={ratePlan?.defMinLos ?? ""} className={inputCls} placeholder="—" />
        </Field>
        <Field label="Maximum stay (nights)" hint="Applies to all dates">
          <input name="defMaxLos" type="number" min={0} defaultValue={ratePlan?.defMaxLos ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Book at least (days ahead)" hint="Auto-closes the next N days (rolling)">
          <input name="defAdvancePurchaseMin" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMin ?? ""} className={inputCls} placeholder="—" />
        </Field>
        <Field label="Book at most (days ahead)" hint="Auto-closes beyond N days (rolling)">
          <input name="defAdvancePurchaseMax" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMax ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
    </div>
  );
}

/**
 * The plan and its defaults, as two cards of ONE form on the plan's own page — `saveRatePlan` writes
 * both at once. It posts no `priceLogic`, so saving here never touches where the price comes from;
 * that has its own section with its own guardrails.
 */
export function RatePlanEditor({ ratePlan }: { ratePlan: RatePlanValues }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRatePlan, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);

  return (
    <form action={formAction} onChange={() => setSavedAt(null)} className="space-y-5">
      <input type="hidden" name="id" value={ratePlan.id} />
      <Card>
        <CardHeader title="The plan" subtitle="Its name, and where it is sold" />
        <div className="px-5 pb-5"><RatePlanBasicsFields ratePlan={ratePlan} /></div>
      </Card>
      <Card>
        <CardHeader title="Defaults" subtitle="Minimum stay and advance purchase, used on every date that has no rule of its own" />
        <div className="px-5 pb-5"><RatePlanDefaultsFields ratePlan={ratePlan} /></div>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state?.error && <p className="mr-auto text-[12.5px] font-medium text-danger-600">{state.error}</p>}
        {savedAt && !state?.error && (
          <p className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success-600"><Check className="h-4 w-4" /> Saved</p>
        )}
        <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
