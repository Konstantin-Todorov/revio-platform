"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { saveChannelSettings, addChannel, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

type Channel = {
  id: string; name: string; currency: string; conversionType: string;
  markupPct: number; commissionPct: number; rounding: string;
};

export function ChannelSettingsDialog({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveChannelSettings, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Channel settings" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
        <Settings2 className="h-4 w-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${channel.name} — settings`}>
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="id" value={channel.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency" hint="Inherited from property">
              <input value={channel.currency} disabled className={`${inputCls} bg-surface-muted text-ink-400`} />
            </Field>
            <Field label="Conversion">
              <select name="conversionType" defaultValue={channel.conversionType} className={inputCls}>
                <option value="none">No conversion</option>
                <option value="manual">Manual fixed rate</option>
                <option value="auto">Automatic daily</option>
                <option value="channel_override">Channel override</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="FX markup %"><input name="markupPct" type="number" step="0.1" defaultValue={channel.markupPct} className={inputCls} /></Field>
            <Field label="Commission %"><input name="commissionPct" type="number" step="0.1" defaultValue={channel.commissionPct} className={inputCls} /></Field>
            <Field label="Rounding">
              <select name="rounding" defaultValue={channel.rounding} className={inputCls}>
                <option value="none">None</option>
                <option value="end_99">.99</option>
                <option value="nearest_minor_1">Whole</option>
                <option value="nearest_minor_50">0.50</option>
              </select>
            </Field>
          </div>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save settings"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AddChannelDialog({ connectedCodes }: { connectedCodes: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(addChannel, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  const all = [
    ["booking", "Booking.com"], ["expedia", "Expedia"], ["trip", "Trip.com"], ["agoda", "Agoda"],
    ["airbnb", "Airbnb"], ["hotelbeds", "Hotelbeds"], ["hrs", "HRS"], ["webbeds", "WebBeds"],
  ].filter(([code]) => !connectedCodes.includes(code as string));

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Connect Channel
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Connect a channel">
        <form action={formAction} className="space-y-3.5">
          <Field label="Channel">
            <select name="code" className={inputCls} required>
              {all.length === 0 && <option value="">All channels already connected</option>}
              {all.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
          <Field label="Property ID on channel" hint="The OTA's id for this hotel — currency is inherited from the property">
            <input name="externalPropertyId" className={inputCls} placeholder="e.g. 88291" />
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending || all.length === 0} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Connecting…" : "Connect & push"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
