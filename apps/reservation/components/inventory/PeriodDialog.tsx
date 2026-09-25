"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { inventory as inventoryDict } from "@/lib/i18n/inventory";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { addInventoryPeriod } from "@/lib/actions-inventory";
import { DateField } from "@revio/ui/date-field";

import { SubmitButton } from "@revio/ui/submit-button";
/**
 * Add an out-of-order or closure period — the date-sensitive layer the waterfall subtracts from the
 * physical count. Same modal/action pattern as the CM's dialogs.
 */
export function PeriodDialog({
  roomTypes, todayIso,
}: {
  roomTypes: { id: string; name: string; totalRooms: number }[];
  todayIso: string;
}) {
  const [open, setOpen] = useState(false);
  const s = translate(inventoryDict, useLocale());
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const maxRooms = roomTypes.find((r) => r.id === roomTypeId)?.totalRooms ?? 1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <Plus className="h-3.5 w-3.5" /> {s.period.add}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={s.period.title}>
        <form action={addInventoryPeriod} onSubmit={() => setOpen(false)} className="space-y-4">
          <Field label={s.period.roomType}>
            <select name="roomTypeId" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputCls}>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
          </Field>
          <Field label={s.period.kind} hint={s.period.kindHint}>
            <select name="kind" defaultValue="out_of_order" className={inputCls}>
              <option value="out_of_order">{s.period.outOfOrder}</option>
              <option value="closure">{s.period.closure}</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={s.period.from}>
              <DateField name="dateFrom" defaultValue={todayIso} min={todayIso} required className={inputCls} />
            </Field>
            <Field label={s.period.to}>
              <DateField name="dateTo" defaultValue={todayIso} min={todayIso} required className={inputCls} />
            </Field>
          </div>
          <Field label={s.period.units} hint={s.period.unitsHint(maxRooms)}>
            <input type="number" name="rooms" defaultValue={1} min={1} max={maxRooms} required className={inputCls} />
          </Field>
          <Field label={s.period.note}>
            <input name="note" placeholder={s.period.notePlaceholder} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">
              {s.period.cancel}
            </button>
            <SubmitButton className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700" pendingLabel={s.period.saving}>
              {s.period.add}
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
