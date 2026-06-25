"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRestrictionRule, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type Rule = {
  id: string; name: string; type: string; roomTypeId: string | null; channelCodes: string[];
  dateFrom: Date; dateTo: Date; valueInt: number | null; priority: number; active: boolean;
};
type Opt = { id: string; name: string };
type Channel = { code: string; name: string };

const TYPES = [
  ["min_los", "Min LOS"], ["max_los", "Max LOS"], ["stop_sell", "Stop Sell"],
  ["cta", "Closed to Arrival"], ["ctd", "Closed to Departure"],
  ["advance_purchase_min", "Advance Purchase (min)"], ["advance_purchase_max", "Advance Purchase (max)"],
];

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function RestrictionDialog({ rule, roomTypes, channels }: { rule?: Rule; roomTypes: Opt[]; channels: Channel[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRestrictionRule, null);
  const isEdit = !!rule;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      {isEdit ? (
        <button onClick={() => setOpen(true)} aria-label="Edit rule" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add Rule
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? `Edit ${rule!.name}` : "Add Restriction Rule"}>
        <form action={formAction} className="space-y-3.5">
          {isEdit && <input type="hidden" name="id" value={rule!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rule name"><input name="name" defaultValue={rule?.name} required className={inputCls} placeholder="Easter Minimum Stay" /></Field>
            <Field label="Type">
              <select name="type" defaultValue={rule?.type ?? "min_los"} className={inputCls}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="From"><input name="dateFrom" type="date" defaultValue={rule ? iso(rule.dateFrom) : today} required className={inputCls} /></Field>
            <Field label="To"><input name="dateTo" type="date" defaultValue={rule ? iso(rule.dateTo) : today} required className={inputCls} /></Field>
            <Field label="Value" hint="Days/nights"><input name="value" type="number" min={0} defaultValue={rule?.valueInt ?? 2} className={inputCls} /></Field>
          </div>
          <Field label="Room type">
            <select name="roomTypeId" defaultValue={rule?.roomTypeId ?? ""} className={inputCls}>
              <option value="">All rooms</option>
              {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Channels</span>
            <div className="flex flex-wrap gap-1.5">
              {channels.map((c) => (
                <label key={c.code} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name="channelCodes" value={c.code} defaultChecked={rule ? rule.channelCodes.includes(c.code) : true} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" hint="Higher wins"><input name="priority" type="number" defaultValue={rule?.priority ?? 5} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] font-medium text-ink-700">
              <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Active
            </label>
          </div>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
