"use client";

import { useState, useTransition } from "react";
import { Link2, Unlink, Pencil } from "lucide-react";
import { saveRatePlanLinkage, type ActionResult } from "@/lib/actions";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export type LinkPlan = {
  id: string;
  name: string;
  priceLogic: string; // manual | derived
  active: boolean;
  parentRatePlanId: string | null;
  parentName: string | null;
  derivedType: string | null;
  derivedDirection: string | null;
  derivedValue: number | null;
  derivedRounding: string | null;
  directChannelEnabled: boolean;
};

function offsetOf(p: LinkPlan): string {
  const sign = p.derivedDirection === "increase" ? "+" : "−";
  return p.derivedType === "percent" ? `${sign}${p.derivedValue}%` : `${sign}€${((p.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
}

/**
 * Editable Rate Plan Linkage (spec §4.2). A derivation tree for overview, plus per-plan Edit / Unlink.
 * Derived prices are computed live from the parent, so a change recalculates every child automatically;
 * the guardrails (no cycles, manual root, max depth) are enforced server-side in saveRatePlanLinkage.
 */
export function RatePlanLinkageBoard({ plans }: { plans: LinkPlan[] }) {
  const [editing, setEditing] = useState<LinkPlan | null>(null);
  const roots = plans.filter((p) => p.priceLogic === "manual");
  const childrenOf = (id: string) => plans.filter((p) => p.parentRatePlanId === id);

  const Node = ({ plan, depth }: { plan: LinkPlan; depth: number }) => {
    const kids = childrenOf(plan.id);
    return (
      <div className={depth > 0 ? "mt-1.5 pl-4" : ""}>
        <div className="flex items-center gap-2 text-[12.5px]">
          {depth > 0 && <span className="text-ink-300">↓</span>}
          {depth > 0 && <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{offsetOf(plan)}</span>}
          <span className={`font-semibold ${plan.active ? (depth === 0 ? "text-brand-800" : "text-ink-800") : "text-ink-400 line-through"}`}>{plan.name}</span>
          {depth === 0 && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-700">manual</span>}
          {!plan.directChannelEnabled && <span title="Not bookable on the direct channel" className="rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-bold uppercase text-ink-400">OTA/corp</span>}
          <button type="button" onClick={() => setEditing(plan)} title="Edit linkage" className="ml-1 flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-surface-muted hover:text-brand-600">
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        {kids.map((k) => <Node key={k.id} plan={k} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="p-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {roots.map((root) => <Node key={root.id} plan={root} depth={0} />)}
        {roots.length === 0 && <p className="text-[13px] text-ink-400">Add a manual rate plan first — derived plans hang off it.</p>}
      </div>
      <p className="mt-4 text-[11.5px] text-ink-400">
        Click the <Pencil className="mb-0.5 inline h-3 w-3" /> on any rate plan to change its parent or offset, or to switch it
        between manual and derived. Loops and over-deep chains are rejected; a derived rate always traces back to a manual base rate.
      </p>
      {editing && <LinkageEditor plan={editing} options={plans} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LinkageEditor({ plan, options, onClose }: { plan: LinkPlan; options: LinkPlan[]; onClose: () => void }) {
  const [derived, setDerived] = useState(plan.priceLogic === "derived");
  const [parentId, setParentId] = useState(plan.parentRatePlanId ?? options.find((o) => o.id !== plan.id)?.id ?? "");
  const [direction, setDirection] = useState(plan.derivedDirection ?? "decrease");
  const [type, setType] = useState(plan.derivedType ?? "percent");
  const [value, setValue] = useState(String(plan.derivedValue ?? 10));
  const [rounding, setRounding] = useState(plan.derivedRounding ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parentOpts = options.filter((o) => o.id !== plan.id);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res: ActionResult = await saveRatePlanLinkage(
        derived
          ? { ratePlanId: plan.id, mode: "derive", parentRatePlanId: parentId, derivedDirection: direction, derivedType: type, derivedValue: Number(value), derivedRounding: rounding }
          : { ratePlanId: plan.id, mode: "unlink" },
      );
      if (res.ok) onClose();
      else setError(res.error ?? "Could not save the linkage.");
    });
  }

  return (
    <Modal open onClose={onClose} title={`Linkage · ${plan.name}`}>
      <div className="space-y-3.5">
        <Field label="Pricing">
          <select value={derived ? "derived" : "manual"} onChange={(e) => setDerived(e.target.value === "derived")} className={inputCls}>
            <option value="manual">Manual — entered by hand</option>
            <option value="derived">Derived — computed from a parent</option>
          </select>
        </Field>

        {derived ? (
          <div className="space-y-3 rounded-md border border-surface-border bg-surface-muted p-3">
            <Field label="Derived from (parent)">
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
                {parentOpts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.priceLogic === "derived" ? " (derived)" : ""}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Direction">
                <select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputCls}><option value="decrease">Decrease</option><option value="increase">Increase</option></select>
              </Field>
              <Field label="By">
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}><option value="percent">Percent %</option><option value="fixed">Fixed (cents)</option></select>
              </Field>
              <Field label="Value"><input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Rounding">
              <select value={rounding} onChange={(e) => setRounding(e.target.value)} className={inputCls}>
                <option value="none">None</option><option value="end_99">End in .99</option><option value="nearest_minor_1">Nearest whole</option><option value="nearest_minor_50">Nearest 0.50</option>
              </select>
            </Field>
          </div>
        ) : (
          <p className="rounded-md bg-surface-muted px-3 py-2.5 text-[12px] text-ink-500">This plan will be priced by hand. Any prices you set on the calendar or in bulk apply directly to it.</p>
        )}

        <p className="rounded-md border border-surface-border bg-white px-3 py-2 text-[11.5px] text-ink-400">
          Derived prices are computed live from the parent — a plan’s own manual prices are ignored while it’s derived and used
          again if you switch it back to manual. Nothing is overwritten.
        </p>

        {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {plan.priceLogic === "derived" && derived && (
            <button type="button" onClick={() => { setDerived(false); }} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-danger-600">
              <Unlink className="h-3.5 w-3.5" /> Unlink
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">Cancel</button>
            <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <Link2 className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Save linkage"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
