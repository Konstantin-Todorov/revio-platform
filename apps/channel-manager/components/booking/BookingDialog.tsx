"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { simulateBooking, type ActionResult } from "@/lib/actions-calendar";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type Opt = { id: string; name: string; code?: string };
type Options = { channels: Opt[]; roomTypes: Opt[]; ratePlans: Opt[] };

export function BookingDialog({ options, defaultRoomTypeId }: { options: Options; defaultRoomTypeId?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(simulateBooking, null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500">
        <Sparkles className="h-4 w-4" /> Simulate booking
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Simulate a channel booking">
        {(options.channels.length === 0 || options.roomTypes.length === 0 || options.ratePlans.length === 0) ? (
          <div className="py-2 text-[13px] text-ink-600">
            To simulate a booking you need at least one <span className="font-semibold">room type</span>, one
            <span className="font-semibold"> rate plan</span>, and one connected <span className="font-semibold">channel</span>.
            Add them in <span className="font-semibold text-ink-800">Rooms &amp; Rates</span> and <span className="font-semibold text-ink-800">Channels</span> first.
          </div>
        ) : (
        <>
        <p className="mb-3 text-[12.5px] text-ink-500">
          Books on a (mock) channel, imports the reservation, drops availability for those nights, and re-pushes —
          the full <span className="font-semibold text-ink-700">edit → book → pull → re-push</span> loop.
        </p>
        <form action={formAction} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Guest name"><input name="guestName" className={inputCls} placeholder="Walk-in Guest" /></Field>
            <Field label="Channel">
              <select name="channelId" className={inputCls} required>
                {options.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room type">
              <select name="roomTypeId" defaultValue={defaultRoomTypeId} className={inputCls} required>
                {options.roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Rate plan">
              <select name="ratePlanId" className={inputCls} required>
                {options.ratePlans.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Check-in"><input name="checkIn" type="date" defaultValue={today} className={inputCls} required /></Field>
            <Field label="Nights"><input name="nights" type="number" min={1} defaultValue={2} className={inputCls} /></Field>
            <Field label="Rooms"><input name="quantity" type="number" min={1} defaultValue={1} className={inputCls} /></Field>
          </div>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-accent-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-500 disabled:opacity-60">
              {pending ? "Booking…" : "Create booking"}
            </button>
          </div>
        </form>
        </>
        )}
      </Modal>
    </>
  );
}
