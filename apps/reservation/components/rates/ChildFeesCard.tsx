"use client";

import { useActionState, useEffect, useState } from "react";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { Card, CardHeader } from "@revio/ui/primitives";
import { ActionForm } from "@revio/ui/action-form";
import { SaveFooter } from "./RoomTypeForm";
import { saveChildFees } from "@/lib/actions-rates";
import { terms as termsDict } from "@/lib/i18n/terms";

type Result = { ok: boolean; error?: string };

/**
 * What a child and an infant add per night on this rate. Children are their own axis beside adult
 * occupancy (OBP §6.9) — the adults' price is looked up as before, and these are added on top.
 */
export function ChildFeesCard({ ratePlanId, currency, childrenFeeMinor, infantFeeMinor, bands }: {
  ratePlanId: string;
  currency: string;
  childrenFeeMinor: number;
  infantFeeMinor: number;
  bands: { infantMax: number; childMax: number };
}) {
  const s = translate(termsDict, useLocale()).children;
  const [state, formAction, pending] = useActionState<Result | null, FormData>(saveChildFees as never, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);
  const input = "h-[38px] w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-500";
  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";
  return (
    <ActionForm action={formAction} state={state} onChange={() => setSavedAt(null)}>
      <input type="hidden" name="id" value={ratePlanId} />
      <Card>
        <CardHeader title={s.title} subtitle={s.subtitle(bands.infantMax, bands.childMax)} />
        <div className="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="cf-child">{s.childFee(currency)}</label>
            <input id="cf-child" name="childrenFee" type="number" step="0.01" min="0" defaultValue={(childrenFeeMinor / 100).toFixed(2)} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="cf-infant">{s.infantFee(currency)}</label>
            <input id="cf-infant" name="infantFee" type="number" step="0.01" min="0" defaultValue={(infantFeeMinor / 100).toFixed(2)} className={input} />
          </div>
          <p className="text-[12px] text-ink-500 sm:col-span-2">{s.note}</p>
        </div>
        <SaveFooter pending={pending} error={state?.error} saved={!!savedAt && !state?.error} />
      </Card>
    </ActionForm>
  );
}
