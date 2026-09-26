"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { calendar as calDict } from "@/lib/i18n/calendar";

import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { simulateBooking, type ActionResult } from "@/lib/actions-calendar";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { DateField } from "@revio/ui/date-field";

type Opt = { id: string; name: string; code?: string };
type Options = { channels: Opt[]; roomTypes: Opt[]; ratePlans: Opt[] };

export function BookingDialog({ options, today, defaultRoomTypeId }: { options: Options; today: string; defaultRoomTypeId?: string }) {
  const [open, setOpen] = useState(false);
  const b = translate(calDict, useLocale()).booking;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(simulateBooking, null);
  // `today` is the PROPERTY's date, passed from the server — see packages/core/src/stays/past-dates.ts.


  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500">
        <Sparkles className="h-4 w-4" /> {b.open}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={b.title}>
        {(options.channels.length === 0 || options.roomTypes.length === 0 || options.ratePlans.length === 0) ? (
          <div className="py-2 text-[13px] text-ink-600">{b.need}</div>
        ) : (
        <>
        <p className="mb-3 text-[12.5px] text-ink-500">
          {b.intro}<span className="font-semibold text-ink-700">{b.loop}</span>.
        </p>
        <form action={formAction} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={b.guest}><input name="guestName" className={inputCls} placeholder={b.guestPlaceholder} /></Field>
            <Field label={b.channel}>
              <select name="channelId" className={inputCls} required>
                {options.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={b.roomType}>
              <select name="roomTypeId" defaultValue={defaultRoomTypeId} className={inputCls} required>
                {options.roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label={b.ratePlan}>
              <select name="ratePlanId" className={inputCls} required>
                {options.ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={b.checkIn}><DateField name="checkIn" defaultValue={today} min={today} className={inputCls} required /></Field>
            <Field label={b.nights}><input name="nights" type="number" min={1} defaultValue={2} className={inputCls} /></Field>
            <Field label={b.roomsCount}><input name="quantity" type="number" min={1} defaultValue={1} className={inputCls} /></Field>
          </div>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{b.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-accent-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60">
              {pending ? b.booking : b.create}
            </button>
          </div>
        </form>
        </>
        )}
      </Modal>
    </>
  );
}
