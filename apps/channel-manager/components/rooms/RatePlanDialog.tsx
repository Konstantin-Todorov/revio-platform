"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRatePlan, type ActionResult } from "@/lib/actions";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rooms as roomsDict } from "@/lib/i18n/rooms";

type RatePlan = {
  id: string; name: string; code: string; tags: string[]; priceLogic: string; active: boolean;
  parentRatePlanId: string | null; derivedType: string | null; derivedDirection: string | null;
  derivedValue: number | null; derivedRounding: string | null;
  defMinLos: number | null; defMaxLos: number | null;
  defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null;
};
type Parent = { id: string; name: string };

export function RatePlanDialog({ ratePlan, parents }: { ratePlan?: RatePlan; parents: Parent[] }) {
  const r = translate(roomsDict, useLocale());
  const f = r.planForm;
  const l = r.linkage;
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
        <button onClick={() => setOpen(true)} aria-label={f.edit} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" /> {f.add}
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? f.editTitle(ratePlan!.name) : f.addTitle}>
        <form action={formAction} className="space-y-3.5">
          {isEdit && <input type="hidden" name="id" value={ratePlan!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label={f.name}><input name="name" defaultValue={ratePlan?.name} required className={inputCls} placeholder={f.namePlaceholder} /></Field>
            <Field label={f.code}><input name="code" defaultValue={ratePlan?.code} required className={inputCls} placeholder="NR" /></Field>
          </div>
          <Field label={f.tags} hint={f.tagsHint}>
            <input name="tags" defaultValue={ratePlan?.tags.join(", ")} className={inputCls} placeholder={f.tagsPlaceholder} />
          </Field>
          <Field label={l.pricing}>
            <select name="priceLogic" defaultValue={ratePlan?.priceLogic ?? "manual"} onChange={(e) => setDerived(e.target.value === "derived")} className={inputCls}>
              <option value="manual">{l.manual}</option>
              <option value="derived">{l.derived}</option>
            </select>
          </Field>

          {derived && (
            <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted p-3">
              <Field label={l.parent}>
                <select name="parentRatePlanId" defaultValue={ratePlan?.parentRatePlanId ?? parents[0]?.id} className={inputCls}>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label={l.direction}>
                  <select name="derivedDirection" defaultValue={ratePlan?.derivedDirection ?? "decrease"} className={inputCls}>
                    <option value="decrease">{l.decrease}</option>
                    <option value="increase">{l.increase}</option>
                  </select>
                </Field>
                <Field label={l.by}>
                  <select name="derivedType" defaultValue={ratePlan?.derivedType ?? "percent"} className={inputCls}>
                    <option value="percent">{l.percent}</option>
                    <option value="fixed">{l.fixed}</option>
                  </select>
                </Field>
                <Field label={l.value}><input name="derivedValue" type="number" min={0} defaultValue={ratePlan?.derivedValue ?? 10} className={inputCls} /></Field>
              </div>
              <Field label={l.rounding}>
                <select name="derivedRounding" defaultValue={ratePlan?.derivedRounding ?? "none"} className={inputCls}>
                  <option value="none">{l.roundings.none}</option>
                  <option value="end_99">{l.roundings.end_99}</option>
                  <option value="nearest_minor_1">{l.roundings.nearest_minor_1}</option>
                  <option value="nearest_minor_50">{l.roundings.nearest_minor_50}</option>
                </select>
              </Field>
            </div>
          )}

          {/* Rate-plan-level restrictions — sent for all dates (Min/Max stay) and rolling-close
              (advance purchase). Leave a field blank to mean "no rule". */}
          <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{f.restrictions}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={f.minStay} hint={f.allDates}>
                <input name="defMinLos" type="number" min={0} defaultValue={ratePlan?.defMinLos ?? ""} className={inputCls} placeholder="—" />
              </Field>
              <Field label={f.maxStay} hint={f.allDates}>
                <input name="defMaxLos" type="number" min={0} defaultValue={ratePlan?.defMaxLos ?? ""} className={inputCls} placeholder="—" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={f.advMin} hint={f.advMinHint}>
                <input name="defAdvancePurchaseMin" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMin ?? ""} className={inputCls} placeholder="—" />
              </Field>
              <Field label={f.advMax} hint={f.advMaxHint}>
                <input name="defAdvancePurchaseMax" type="number" min={0} defaultValue={ratePlan?.defAdvancePurchaseMax ?? ""} className={inputCls} placeholder="—" />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="active" defaultChecked={ratePlan?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {f.active}
          </label>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{r.save.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? r.save.saving : isEdit ? r.save.saveChanges : f.create}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
