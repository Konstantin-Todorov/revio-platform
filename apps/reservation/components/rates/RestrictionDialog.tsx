"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { bulk as bulkDict } from "@/lib/i18n/bulk";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { saveRestrictionRule, type ActionResult } from "@/lib/actions-rates";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";
import { earliestSelectable } from "@revio/core";

type Rule = {
  id: string; name: string; type: string; roomTypeId: string | null; channelCodes: string[]; sourceCategories: string[];
  dateFrom: Date; dateTo: Date; valueInt: number | null; priority: number; active: boolean;
};
type Opt = { id: string; name: string };
type Channel = { code: string; name: string };

const TYPES = ["min_los", "max_los", "stop_sell", "cta", "ctd", "advance_purchase_min", "advance_purchase_max"] as const;
const SOURCE_CATEGORIES = ["direct", "ota", "gds", "call_center", "corporate", "travel_agent"] as const;

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

export function RestrictionDialog({ rule, today, roomTypes, channels }: { rule?: Rule; today: string; roomTypes: Opt[]; channels: Channel[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRestrictionRule, null);
  const isEdit = !!rule;
  const b = translate(bulkDict, useLocale());
  const d = b.dialog;
  /*
   * ⚠️ `today` comes from the server at the PROPERTY's timezone; it used to be read off the
   * browser's clock here. `earliestSelectable` is what keeps this "most cases, not all": a NEW rule
   * cannot start before today, while an existing rule that already starts in the past stays
   * editable at its own date — changing its value must not force a date that has happened to move.
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
        <form action={formAction} className="space-y-3.5">
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
          <Field label={d.roomType}>
            <select name="roomTypeId" defaultValue={rule?.roomTypeId ?? ""} className={inputCls}>
              <option value="">{d.allRooms}</option>
              {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
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
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">{d.sources} <span className="font-normal text-ink-400">{d.sourcesHint}</span></span>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_CATEGORIES.map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                  <input type="checkbox" name="sourceCategories" value={v} defaultChecked={rule?.sourceCategories.includes(v) ?? false} className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" />
                  {b.sources[v]}
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
        </form>
      </Modal>
    </>
  );
}
