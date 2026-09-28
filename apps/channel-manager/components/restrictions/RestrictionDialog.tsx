"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRestrictionRule, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";
import { earliestSelectable } from "@revio/core";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { bulk as bulkDict } from "@/lib/i18n/bulk";
import { ActionForm } from "@revio/ui/action-form";

type Rule = {
  id: string; name: string; type: string; roomTypeId: string | null; ratePlanId: string | null;
  channelCodes: string[];
  dateFrom: Date; dateTo: Date; valueInt: number | null; priority: number; active: boolean;
};
type Opt = { id: string; name: string };
type Channel = { code: string; name: string };

const TYPES = ["min_los", "max_los", "stop_sell", "cta", "ctd", "advance_purchase_min", "advance_purchase_max"] as const;

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function RestrictionDialog({ rule, today, roomTypes, ratePlans, channels }: { rule?: Rule; today: string; roomTypes: Opt[]; ratePlans: Opt[]; channels: Channel[] }) {
  const b = translate(bulkDict, useLocale());
  const d = b.dialog;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRestrictionRule, null);
  const isEdit = !!rule;
  /*
   * ⚠️ `today` is passed in from the server at the PROPERTY's timezone. It used to be derived here
   * from `new Date()` — the browser's clock — which is wrong twice over: a receptionist's laptop
   * set to another zone disagreed with the inventory this rule governs, and a UTC-derived date is a
   * day behind a Bulgarian hotel until 03:00 every morning.
   *
   * `earliestSelectable` is what makes this "most places, not all": a NEW rule cannot start before
   * today, but an existing rule that already starts in the past stays editable at its own date —
   * you can change its value or its rooms without being forced to move a date that has happened.
   */
  const earliest = earliestSelectable(today, rule ? iso(rule.dateFrom) : null);

  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      {isEdit ? (
        <button onClick={() => setOpen(true)} aria-label={d.edit} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" /> {d.add}
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? d.editTitle(rule!.name) : d.addTitle}>
        <ActionForm action={formAction} state={state} className="space-y-3.5">
          {isEdit && <input type="hidden" name="id" value={rule!.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label={d.name}><input name="name" defaultValue={rule?.name} required className={inputCls} placeholder={d.namePlaceholder} /></Field>
            <Field label={d.type}>
              <select name="type" defaultValue={rule?.type ?? "min_los"} className={inputCls}>
                {TYPES.map((v) => <option key={v} value={v}>{b.ruleTypes[v]}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={d.from}><DateField name="dateFrom" defaultValue={rule ? iso(rule.dateFrom) : today} min={earliest} required className={inputCls} /></Field>
            <Field label={d.to}><DateField name="dateTo" defaultValue={rule ? iso(rule.dateTo) : today} min={earliest} required className={inputCls} /></Field>
            <Field label={d.value} hint={d.valueHint}><input name="value" type="number" min={0} defaultValue={rule?.valueInt ?? 2} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={d.roomType}>
              <select name="roomTypeId" defaultValue={rule?.roomTypeId ?? ""} className={inputCls}>
                <option value="">{d.allRooms}</option>
                {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            {/* A rule can bind to ONE rate plan — a minimum stay that applies to the flexible rate
                but not the breakfast rate is an ordinary thing for a hotel to want, and the only
                place in the product that can express it. A calendar edit is per room type. */}
            <Field label={d.ratePlan} hint={d.ratePlanHint}>
              <select name="ratePlanId" defaultValue={rule?.ratePlanId ?? ""} className={inputCls}>
                <option value="">{d.allRatePlans}</option>
                {ratePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">{d.channels}</span>
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
            <Field label={d.priority} hint={d.priorityHint}><input name="priority" type="number" min={0} max={100} defaultValue={rule?.priority ?? 5} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] font-medium text-ink-700">
              <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {d.active}
            </label>
          </div>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{d.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              {pending ? d.saving : isEdit ? d.saveChanges : d.create}
            </button>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
