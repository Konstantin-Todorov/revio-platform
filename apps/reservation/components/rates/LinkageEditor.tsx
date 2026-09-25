"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rates as ratesDict } from "@/lib/i18n/rates";

import { useState, useTransition } from "react";
import { Link2, Unlink } from "lucide-react";
import { saveRatePlanLinkage, type ActionResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export type LinkPlan = {
  id: string;
  name: string;
  priceLogic: string;
  active: boolean;
  parentRatePlanId: string | null;
  parentName: string | null;
  derivedType: string | null;
  derivedDirection: string | null;
  derivedValue: number | null;
  derivedRounding: string | null;
  directChannelEnabled: boolean;
};


/**
 * Editable Rate Plan Linkage (CRS-REFINEMENT-R2 §6) — the CRS twin of RevioLink's board, edited on the
 * plan's own page. Derived prices compute live from the parent, so a change recalculates every child;
 * the guardrails (no cycles, manual root, max depth) are enforced server-side.
 */
export function LinkageEditor({ plan, options, onClose }: { plan: LinkPlan; options: LinkPlan[]; onClose: () => void }) {
  const [derived, setDerived] = useState(plan.priceLogic === "derived");
  const [parentId, setParentId] = useState(plan.parentRatePlanId ?? options.find((o) => o.id !== plan.id)?.id ?? "");
  const [direction, setDirection] = useState(plan.derivedDirection ?? "decrease");
  const [type, setType] = useState(plan.derivedType ?? "percent");
  const [value, setValue] = useState(String(plan.derivedValue ?? 10));
  const [rounding, setRounding] = useState(plan.derivedRounding ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parentOpts = options.filter((o) => o.id !== plan.id);
  const s = translate(ratesDict, useLocale());
  const l = s.linkage;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res: ActionResult = await saveRatePlanLinkage(
        derived
          ? { ratePlanId: plan.id, mode: "derive", parentRatePlanId: parentId, derivedDirection: direction, derivedType: type, derivedValue: Number(value), derivedRounding: rounding }
          : { ratePlanId: plan.id, mode: "unlink" },
      );
      if (res.ok) onClose();
      else setError(res.error ?? l.failed);
    });
  }

  return (
    <Modal open onClose={onClose} title={l.title(plan.name)}>
      <div className="space-y-3.5">
        <Field label={l.pricing}>
          <select value={derived ? "derived" : "manual"} onChange={(e) => setDerived(e.target.value === "derived")} className={inputCls}>
            <option value="manual">{l.manual}</option>
            <option value="derived">{l.derived}</option>
          </select>
        </Field>

        {derived ? (
          <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted p-3">
            <Field label={l.parent}>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
                {parentOpts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.priceLogic === "derived" ? l.derivedSuffix : ""}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={l.direction}>
                <select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputCls}><option value="decrease">{l.decrease}</option><option value="increase">{l.increase}</option></select>
              </Field>
              <Field label={l.by}>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}><option value="percent">{l.percent}</option><option value="fixed">{l.fixed}</option></select>
              </Field>
              <Field label={l.value}><input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label={l.rounding}>
              <select value={rounding} onChange={(e) => setRounding(e.target.value)} className={inputCls}>
                <option value="none">{l.roundings.none}</option><option value="end_99">{l.roundings.end_99}</option><option value="nearest_minor_1">{l.roundings.nearest_minor_1}</option><option value="nearest_minor_50">{l.roundings.nearest_minor_50}</option>
              </select>
            </Field>
          </div>
        ) : (
          <p className="rounded-md bg-surface-muted px-3 py-2.5 text-[12px] text-ink-500">{l.manualNote}</p>
        )}

        <p className="rounded-md border border-surface-border bg-white px-3 py-2 text-[11.5px] text-ink-400">
          {l.liveNote}
        </p>

        {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {plan.priceLogic === "derived" && derived && (
            <button type="button" onClick={() => setDerived(false)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-danger-600">
              <Unlink className="h-3.5 w-3.5" /> {l.unlink}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">{s.save.cancel}</button>
            <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <Link2 className="h-3.5 w-3.5" /> {pending ? s.save.saving : l.saveLinkage}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
