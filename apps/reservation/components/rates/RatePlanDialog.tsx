"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { saveRatePlan, type ActionResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { RatePlanBasicsFields, RatePlanDefaultsFields } from "./RatePlanForm";

type Parent = { id: string; name: string };

/**
 * Add a rate plan. Saving opens the new plan's own page, where how it prices and the rooms it sells
 * are read and changed; editing lives there too, so this dialog only ever creates.
 */
export function RatePlanDialog({ parents }: { parents: Parent[] }) {
  const [open, setOpen] = useState(false);
  const [derived, setDerived] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRatePlan, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      if (state.id) router.push(`/rooms-rates/plans/${state.id}`);
    }
  }, [state, router]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Add rate plan
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add rate plan">
        <form action={formAction} className="space-y-3.5">
          <RatePlanBasicsFields />
          <Field label="Pricing">
            <select name="priceLogic" defaultValue={"manual"} onChange={(e) => setDerived(e.target.value === "derived")} className={inputCls}>
              <option value="manual">Manual — entered by hand</option>
              <option value="derived">Derived — computed from a parent</option>
            </select>
          </Field>

          {derived && (
            <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted p-3">
              <Field label="Derived from (parent)">
                <select name="parentRatePlanId" defaultValue={parents[0]?.id} className={inputCls}>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Direction">
                  <select name="derivedDirection" defaultValue={"decrease"} className={inputCls}>
                    <option value="decrease">Decrease</option>
                    <option value="increase">Increase</option>
                  </select>
                </Field>
                <Field label="By">
                  <select name="derivedType" defaultValue={"percent"} className={inputCls}>
                    <option value="percent">Percent %</option>
                    <option value="fixed">Fixed (cents)</option>
                  </select>
                </Field>
                <Field label="Value"><input name="derivedValue" type="number" min={0} defaultValue={10} className={inputCls} /></Field>
              </div>
              <Field label="Rounding">
                <select name="derivedRounding" defaultValue={"none"} className={inputCls}>
                  <option value="none">None</option>
                  <option value="end_99">End in .99</option>
                  <option value="nearest_minor_1">Nearest whole</option>
                  <option value="nearest_minor_50">Nearest 0.50</option>
                </select>
              </Field>
            </div>
          )}

          <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Stay &amp; advance-purchase defaults</div>
            <RatePlanDefaultsFields />
          </div>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Saving…" : "Create rate plan"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
