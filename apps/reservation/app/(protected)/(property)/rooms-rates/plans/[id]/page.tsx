import Link from "next/link";
import { notFound } from "next/navigation";
import { getRatesData, getSetupData } from "@/lib/data";
import { deleteRatePlan } from "@/lib/actions-rates";
import { RatePlanEditor } from "@/components/rates/RatePlanForm";
import { PlanLinkageCard, PlanPricingCard } from "@/components/rates/PlanSections";
import { type LinkPlan } from "@/components/rates/LinkageEditor";
import { offsetOf } from "@/components/rates/plan-labels";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { BackLink } from "@/components/rates/BackLink";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * One rate plan with everything about it: the plan, how it prices, where its price comes from, its
 * defaults and the rooms it sells. These were three cards on the old page, each listing every plan.
 */
export default async function RatePlanPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const [{ id }, { blocked }] = await Promise.all([params, searchParams]);
  const [{ ratePlans, defaults }, { roomTypes }] = await Promise.all([getRatesData(), getSetupData()]);
  const rp = ratePlans.find((p) => p.id === id);
  if (!rp) notFound();

  const propertyModel = defaults?.pricingModel ?? "per_room";
  const toLink = (p: (typeof ratePlans)[number]): LinkPlan => ({
    id: p.id, name: p.name, priceLogic: p.priceLogic, active: p.active,
    parentRatePlanId: p.parentRatePlanId, parentName: p.parent?.name ?? null,
    derivedType: p.derivedType, derivedDirection: p.derivedDirection, derivedValue: p.derivedValue, derivedRounding: p.derivedRounding,
    directChannelEnabled: p.directChannelEnabled,
  });
  const dependents = ratePlans
    .filter((p) => p.priceLogic === "derived" && p.parentRatePlanId === rp.id)
    .map((p) => ({ id: p.id, name: p.name, offset: offsetOf(toLink(p)) }));
  const rooms = roomTypes.filter((r) => rp.roomTypeLinks.some((l) => l.roomTypeId === r.id));
  const pricing = {
    id: rp.id, name: rp.name, active: rp.active,
    pricingModel: rp.pricingModel, primaryOccupancy: rp.primaryOccupancy,
    // The smallest cap among the rooms it sells: a plan cannot price a party its narrowest room
    // cannot hold, so that room — not the largest — sets the ceiling.
    ceiling: Math.min(50, ...(rp.roomTypeLinks.length > 0 ? rp.roomTypeLinks.map((l) => Math.max(1, l.roomType.maxGuests)) : [1])),
    roomCount: rp._count.roomTypeLinks,
  };

  return (
    <>
      <BackLink href="/rooms-rates/plans">All rate plans</BackLink>
      <BlockedNotice name={blocked} />
      <div>
        <h2 className="text-[18px] font-bold tracking-tight text-ink-900">
          {rp.name}
          {!rp.active && <span className="ml-2 align-middle text-[10.5px] font-bold uppercase text-ink-400">inactive</span>}
        </h2>
        <p className="text-[12px] text-ink-500">
          {rp.code} · {rp.mealPlan?.name ?? "room only"}{rp.cancellationPolicy ? ` · ${rp.cancellationPolicy.name}` : ""}
        </p>
      </div>

      <RatePlanEditor ratePlan={rp} />
      <PlanPricingCard plan={pricing} propertyModel={propertyModel} />
      <PlanLinkageCard plan={toLink(rp)} options={ratePlans.map(toLink)} dependents={dependents} />

      <Card>
        <CardHeader title="Rooms it sells" subtitle="This plan's price applies to each of these rooms" />
        <div className="px-5 pb-5">
          {rooms.length === 0 ? (
            <p className="text-[13px] text-ink-500">This plan sells no room yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/rooms-rates/rooms/${r.id}`}
                    className={`inline-flex items-center rounded-full border border-surface-border px-2.5 py-1 text-[12px] font-semibold hover:border-ink-300 ${r.active ? "text-ink-700" : "text-ink-400 line-through"}`}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
        <p className="text-[12px] text-ink-500">
          Delete this plan. A plan mapped in RevioLink must be unmapped first; one in use is deactivated instead.
        </p>
        <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note="Mapped plans must be unmapped in RevioLink first; plans in use are deactivated instead." />
      </div>
    </>
  );
}
