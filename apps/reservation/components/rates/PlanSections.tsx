"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rates as ratesDict } from "@/lib/i18n/rates";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, Link2, User } from "lucide-react";
import { Card, CardHeader } from "@revio/ui/primitives";
import { PricingEditor, type PricingPlan } from "./PricingEditor";
import { LinkageEditor, type LinkPlan } from "./LinkageEditor";
import { offsetOf } from "./plan-labels";
import { moneyIn } from "@/lib/i18n/money";

const editBtn =
  "rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted";

/** How one plan prices — per room or per person — with the choice it inherits said out loud. */
export function PlanPricingCard({ plan, propertyModel }: { plan: PricingPlan; propertyModel: string }) {
  const [editing, setEditing] = useState(false);
  const effective = plan.pricingModel ?? propertyModel;
  const perPerson = effective === "per_person";
  const s = translate(ratesDict, useLocale());
  const p = s.pricing;
  return (
    <Card>
      <CardHeader
        title={p.cardTitle}
        subtitle={p.cardSubtitle}
        action={<button type="button" onClick={() => setEditing(true)} className={editBtn}>{s.linkage.change}</button>}
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-semibold ${perPerson ? "bg-accent-50 text-accent-700" : "bg-surface-sunken text-ink-700"}`}>
          {perPerson ? <User className="h-3.5 w-3.5" /> : <BedDouble className="h-3.5 w-3.5" />}
          {s.pricingModel[effective as "per_room"] ?? effective}
          {perPerson && plan.primaryOccupancy != null && <span className="tnum font-normal text-ink-500">{p.priceIsFor(plan.primaryOccupancy)}</span>}
        </span>
        <span className="text-[12px] text-ink-500">
          {plan.pricingModel == null ? p.follows : p.own}
          {perPerson && p.sleepsUpTo(plan.ceiling)}
        </span>
      </div>
      {editing && <PricingEditor plan={plan} propertyModel={propertyModel} onClose={() => setEditing(false)} />}
    </Card>
  );
}

/**
 * Where one plan's price comes from: its own prices, or a parent's with an offset. The plans priced
 * from THIS one are listed too, because changing it moves theirs.
 */
export function PlanLinkageCard({ plan, options, dependents }: {
  plan: LinkPlan;
  options: LinkPlan[];
  dependents: { id: string; name: string; offset: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const derived = plan.priceLogic === "derived";
  const locale = useLocale();
  const l = translate(ratesDict, locale).linkage;
  const money = moneyIn(locale);
  return (
    <Card>
      <CardHeader
        title={l.cardTitle}
        subtitle={l.cardSubtitle}
        action={<button type="button" onClick={() => setEditing(true)} className={editBtn}>{l.change}</button>}
      />
      <div className="space-y-3 px-5 pb-5 text-[13px]">
        {derived ? (
          <p className="flex flex-wrap items-center gap-2 text-ink-700">
            <Link2 className="h-4 w-4 text-ink-400" />
            {l.pricedFromLabel}
            {plan.parentRatePlanId ? (
              <Link href={`/rooms-rates/plans/${plan.parentRatePlanId}`} className="font-semibold text-brand-700 hover:underline">{plan.parentName ?? l.itsParent}</Link>
            ) : <span className="font-semibold">{plan.parentName ?? l.itsParent}</span>}
            <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[12px] font-semibold text-ink-700">{offsetOf(plan, money)}</span>
          </p>
        ) : (
          <p className="text-ink-700">
            <span className="font-semibold">{l.ownPrices}</span>{l.ownPricesTail}
          </p>
        )}
        {dependents.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">{l.dependents}</div>
            <ul className="flex flex-wrap gap-1.5">
              {dependents.map((c) => (
                <li key={c.id}>
                  <Link href={`/rooms-rates/plans/${c.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-700 hover:border-ink-300">
                    {c.name} <span className="tnum font-normal text-ink-500">{c.offset}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {editing && <LinkageEditor plan={plan} options={options} onClose={() => setEditing(false)} />}
    </Card>
  );
}
