"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRatePlan, type ActionResult } from "@/lib/actions";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type RatePlan = {
  id: string; name: string; code: string; tags: string[]; priceLogic: string; active: boolean;
  parentRatePlanId: string | null; derivedType: string | null; derivedDirection: string | null;
  derivedValue: number | null; derivedRounding: string | null;
  defMinLos: number | null; defMaxLos: number | null;
  defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null;
};
type Parent = { id: string; name: string };

export function RatePlanDialog({ ratePlan, parents }: { ratePlan?: RatePlan; parents: Parent[] }) {
  const [open, setOpen] = useState(false);
  const [derived, setDerived] = useState(ratePlan?.priceLogic === "derived");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRatePlan, null);
  const isEdit = !!ratePlan;

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      {isEdit ? (
        <button onClick={() => setOpen(true)} aria-label="Edit rate plan" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Rate Plan
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? `Edit ${ratePlan!.name}` : "Add Rate Plan"}>
        <form action={formAction} className="space-y-3.5">
          {isEdit && <input type="hidden" name="id" value={ratePlan!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input name="name" defaultValue={ratePlan?.name} required className={inputCls} placeholder="Non Refundable" /></Field>
            <Field label="Code"><input name="code" defaultValue={ratePlan?.code} required className={inputCls} placeholder="NR" /></Field>
          </div>
          <Field label="Tags" hint="Comma-separated, e.g. breakfast, non-refundable">
            <input name="tags" defaultValue={ratePlan?.tags.join(", ")} className={inputCls} placeholder="breakfast, BB" />
          </Field>
          <Field label="Pricing">
            <select name="priceLogic" defaultValue={ratePlan?.priceLogic ?? "manual"} onChange={(e) => setDerived(e.target.value === "derived")} className={inputCls}>
              <option value="manual">Manual — entered by hand</option>
              <option value="derived">Derived — computed from a parent</option>
            </select>
          </Field>

          {derived && (
            <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted p-3">
              <Field label="Derived from (parent)">
                <select name="parentRatePlanId" defaultValue={ratePlan?.parentRatePlanId ?? parents[0]?.id} className={inputCls}>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Direction">
                  <select name="derivedDirection" defaultValue={ratePlan?.derivedDirection ?? "decrease"} className={inputCls}>
                    <option value="decrease">Decrease</option>
                    <option value="increase">Increase</option>
                  </select>
                </Field>
                <Field label="By">
                  <select name="derivedType" defaultValue={ratePlan?.derivedType ?? "percent"} className={inputCls}>
                    <option value="percent">Percent %</option>
                    <option value="fixed">Fixed (cents)</option>
                  </select>
                </Field>
                <Field label="Value"><input name="derivedValue" type="number" min={0} defaultValue={ratePlan?.derivedValue ?? 10} className={inputCls} /></Field>
              </div>
              <Field label="Rounding">
                <select name="derivedRounding" defaultValue={ratePlan?.derivedRounding ?? "none"} className={inputCls}>
                  <option value="none">None</option>
                  <option value="end_99">End in .99</option>
                  <option value="nearest_minor_1">Nearest whole</option>
                  <option value="nearest_minor_50">Nearest 0.50</option>
                </select>
              </Field>
            </div>
          )}

          {/* Rate-plan-level restrictions — sent for all dates (Min/Max stay) and rolling-close
              (advance purchase). Leave a field blank to mean "no rule". */}
          <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Stay &amp; advance-purchase restrictions</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum stay (nights)" hint="Applies to all dates">
                <input name="defMinLos" type="number" min={0} defaultValue={ratePlan?.defMinLos ?? ""} className={inputCls} placeholder="—" />
              </Field>
              <Field label="Maximum stay (nights)" hint="Applies to all dates">
                <input name="defMaxLos" type="number" min={0} defaultValue={ratePlan?.defMaxLos ?? ""} className={inputCls} placeholder="—" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Advance purchase — min days" hint="Auto-closes the next N days (rolling)">
                <input name="defAdvancePurchaseMin" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMin ?? ""} className={inputCls} placeholder="—" />
              </Field>
              <Field label="Advance purchase — max days" hint="Auto-closes beyond N days (rolling)">
                <input name="defAdvancePurchaseMax" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMax ?? ""} className={inputCls} placeholder="—" />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="active" defaultChecked={ratePlan?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Active
          </label>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create rate plan"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
