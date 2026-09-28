"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { saveChannelSettings, addChannel, type ActionResult } from "@/lib/actions-config";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { channels as channelsDict } from "@/lib/i18n/channels";
import { ActionForm } from "@revio/ui/action-form";

type Channel = {
  id: string; name: string; currency: string; conversionType: string;
  markupPct: number; commissionPct: number; rounding: string;
  connectivityMode: string; externalPropertyId: string | null;
};

export function ChannelSettingsDialog({ channel }: { channel: Channel }) {
  const t = translate(channelsDict, useLocale()).settings;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveChannelSettings, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t.open} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
        <Settings2 className="h-4 w-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.title(channel.name)}>
        <ActionForm action={formAction} state={state} className="space-y-3.5">
          <input type="hidden" name="id" value={channel.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.currency} hint={t.currencyHint}>
              <input value={channel.currency} disabled className={`${inputCls} bg-surface-muted text-ink-400`} />
            </Field>
            <Field label={t.conversion}>
              <select name="conversionType" defaultValue={channel.conversionType} className={inputCls}>
                <option value="none">{t.conversions.none}</option>
                <option value="manual">{t.conversions.manual}</option>
                <option value="auto">{t.conversions.auto}</option>
                <option value="channel_override">{t.conversions.channel_override}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.markup}><input name="markupPct" type="number" step="0.1" min={0} max={100} defaultValue={channel.markupPct} className={inputCls} /></Field>
            <Field label={t.commission}><input name="commissionPct" type="number" step="0.1" min={0} max={100} defaultValue={channel.commissionPct} className={inputCls} /></Field>
            <Field label={t.rounding}>
              <select name="rounding" defaultValue={channel.rounding} className={inputCls}>
                <option value="none">{t.roundings.none}</option>
                <option value="end_99">{t.roundings.end_99}</option>
                <option value="nearest_minor_1">{t.roundings.nearest_minor_1}</option>
                <option value="nearest_minor_50">{t.roundings.nearest_minor_50}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-surface-border bg-surface-muted/60 p-3">
            <Field label={t.connectivity} hint={t.connectivityHint}>
              <select name="connectivityMode" defaultValue={channel.connectivityMode} className={inputCls}>
                <option value="mock">{t.connectivityModes.mock}</option>
                <option value="channex_sandbox">{t.connectivityModes.channex_sandbox}</option>
                <option value="channex_prod">{t.connectivityModes.channex_prod}</option>
              </select>
            </Field>
            <Field label={t.uuid} hint={t.uuidHint}>
              <input name="externalPropertyId" defaultValue={channel.externalPropertyId ?? ""} className={inputCls} placeholder={t.uuidPlaceholder} />
            </Field>
          </div>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{t.cancel}</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? t.saving : t.save}</button>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

export function AddChannelDialog({ connectedCodes }: { connectedCodes: string[] }) {
  const c = translate(channelsDict, useLocale());
  const t = c.add;
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
        <Plus className="h-4 w-4" /> {t.button}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.title}>
        <ActionForm action={formAction} state={state} className="space-y-3.5">
          <Field label={t.channel}>
            <select name="code" className={inputCls} required>
              {all.length === 0 && <option value="">{t.allConnected}</option>}
              {all.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </Field>
          <Field label={t.propertyId} hint={t.propertyIdHint}>
            <input name="externalPropertyId" className={inputCls} placeholder={t.propertyIdPlaceholder} />
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">{c.settings.cancel}</button>
            <button type="submit" disabled={pending || all.length === 0} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? t.connecting : t.submit}</button>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
