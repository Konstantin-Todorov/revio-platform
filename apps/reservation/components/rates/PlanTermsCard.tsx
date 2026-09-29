"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { Card, CardHeader } from "@revio/ui/primitives";
import { ActionForm } from "@revio/ui/action-form";
import { SaveFooter } from "./RoomTypeForm";
import { setPlanTerms, type ActionResult } from "@/lib/actions-terms";
import { terms as termsDict } from "@/lib/i18n/terms";

/**
 * Which terms this rate is sold on. Each option carries its own two-fact summary, so choosing is
 * reading — nobody has to open the terms to learn what "FLEX3" means.
 */
export function PlanTermsCard({ ratePlanId, currentId, options }: {
  ratePlanId: string;
  currentId: string | null;
  options: { id: string; name: string; summary: string }[];
}) {
  const s = translate(termsDict, useLocale());
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(setPlanTerms, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [chosen, setChosen] = useState(currentId ?? "");
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);
  const row = (active: boolean) =>
    `flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors ${active ? "border-brand-600 bg-brand-50/40" : "border-surface-border hover:border-ink-300"}`;

  return (
    <ActionForm action={formAction} state={state} onChange={() => setSavedAt(null)}>
      <input type="hidden" name="ratePlanId" value={ratePlanId} />
      <Card>
        <CardHeader
          title={s.planTitle}
          subtitle={s.planSubtitle}
          action={<Link href="/rooms-rates/terms" className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-brand-700 hover:underline">{s.manage}</Link>}
        />
        <div className="space-y-2 px-5 pb-5">
          <label className={row(chosen === "")}>
            <input type="radio" name="policyId" value="" checked={chosen === ""} onChange={() => setChosen("")} className="mt-0.5 h-4 w-4" />
            <span><span className="font-semibold text-ink-900">{s.planNone}</span><span className="block text-[11.5px] text-ink-500">{s.planNoneHint}</span></span>
          </label>
          {options.map((o) => (
            <label key={o.id} className={row(chosen === o.id)}>
              <input type="radio" name="policyId" value={o.id} checked={chosen === o.id} onChange={() => setChosen(o.id)} className="mt-0.5 h-4 w-4" />
              <span><span className="font-semibold text-ink-900">{o.name}</span><span className="block text-[11.5px] text-ink-500">{o.summary}</span></span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-[12.5px] text-ink-500">{s.emptyHint} <Link href="/rooms-rates/terms/new" className="font-semibold text-brand-700 hover:underline">{s.add}</Link></p>
          )}
        </div>
        <SaveFooter pending={pending} error={state?.error} saved={!!savedAt && !state?.error} />
      </Card>
    </ActionForm>
  );
}
