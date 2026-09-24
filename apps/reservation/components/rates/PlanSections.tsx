"use client";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, Link2, User } from "lucide-react";
import { Card, CardHeader } from "@revio/ui/primitives";
import { PricingEditor, type PricingPlan } from "./PricingEditor";
import { LinkageEditor, type LinkPlan } from "./LinkageEditor";
import { offsetOf, PRICING_MODEL_LABEL } from "./plan-labels";

const editBtn =
  "rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted";

/** How one plan prices — per room or per person — with the choice it inherits said out loud. */
export function PlanPricingCard({ plan, propertyModel }: { plan: PricingPlan; propertyModel: string }) {
  const [editing, setEditing] = useState(false);
  const effective = plan.pricingModel ?? propertyModel;
  const perPerson = effective === "per_person";
  return (
    <Card>
      <CardHeader
        title="How it prices"
        subtitle="Per room, or per person — a half-board rate can price per guest beside a room-only rate priced per room"
        action={<button type="button" onClick={() => setEditing(true)} className={editBtn}>Change</button>}
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
        <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-semibold ${perPerson ? "bg-accent-50 text-accent-700" : "bg-surface-sunken text-ink-700"}`}>
          {perPerson ? <User className="h-3.5 w-3.5" /> : <BedDouble className="h-3.5 w-3.5" />}
          {PRICING_MODEL_LABEL[effective] ?? effective}
          {perPerson && plan.primaryOccupancy != null && <span className="tnum font-normal text-ink-500">· the price is for {plan.primaryOccupancy}</span>}
        </span>
        <span className="text-[12px] text-ink-500">
          {plan.pricingModel == null ? "Follows the property setting." : "Set for this plan only."}
          {perPerson && ` Its rooms sleep up to ${plan.ceiling}.`}
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
  return (
    <Card>
      <CardHeader
        title="Where its price comes from"
        subtitle="Its own prices, or another plan's with an offset — a derived price follows its parent on every date"
        action={<button type="button" onClick={() => setEditing(true)} className={editBtn}>Change</button>}
      />
      <div className="space-y-3 px-5 pb-5 text-[13px]">
        {derived ? (
          <p className="flex flex-wrap items-center gap-2 text-ink-700">
            <Link2 className="h-4 w-4 text-ink-400" />
            Priced from
            {plan.parentRatePlanId ? (
              <Link href={`/rooms-rates/plans/${plan.parentRatePlanId}`} className="font-semibold text-brand-700 hover:underline">{plan.parentName ?? "its parent"}</Link>
            ) : <span className="font-semibold">{plan.parentName ?? "its parent"}</span>}
            <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[12px] font-semibold text-ink-700">{offsetOf(plan)}</span>
          </p>
        ) : (
          <p className="text-ink-700">
            <span className="font-semibold">Its own prices</span> — set on the Inventory Calendar or in Bulk Rates &amp; Availability.
          </p>
        )}
        {dependents.length > 0 && (
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Priced from this plan</div>
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
