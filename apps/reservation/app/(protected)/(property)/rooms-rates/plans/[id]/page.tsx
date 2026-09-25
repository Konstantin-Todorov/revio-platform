import Link from "next/link";
import { notFound } from "next/navigation";
import { getRatesData, getSetupData } from "@/lib/data";
import { deleteRatePlan } from "@/lib/actions-rates";
import { RatePlanEditor } from "@/components/rates/RatePlanForm";
import { PlanLinkageCard, PlanPricingCard } from "@/components/rates/PlanSections";
import { type LinkPlan } from "@/components/rates/LinkageEditor";
import { offsetOf } from "@/components/rates/plan-labels";
import { moneyIn } from "@/lib/i18n/money";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { BackLink } from "@/components/rates/BackLink";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { LinkTabs } from "@revio/ui/link-tabs";
import { Card, CardHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { rates as ratesDict } from "@/lib/i18n/rates";

export const dynamic = "force-dynamic";

const TABS = ["plan", "price", "rooms"] as const;
type Tab = (typeof TABS)[number];

/**
 * One rate plan, in three tabs: the plan and its defaults · its price (how it prices, and where the
 * price comes from) · the rooms it sells. The same shape as a room type's page, so the two are read
 * the same way.
 */
export default async function RatePlanPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string; tab?: string }>;
}) {
  const [{ id }, { blocked, tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "plan";
  const [{ ratePlans, defaults }, { roomTypes }] = await Promise.all([getRatesData(), getSetupData()]);
  const rp = ratePlans.find((p) => p.id === id);
  if (!rp) notFound();
  const { t, locale } = await i18n();
  const s = t(ratesDict);
  const money = moneyIn(locale);

  const propertyModel = defaults?.pricingModel ?? "per_room";
  const toLink = (p: (typeof ratePlans)[number]): LinkPlan => ({
    id: p.id, name: p.name, priceLogic: p.priceLogic, active: p.active,
    parentRatePlanId: p.parentRatePlanId, parentName: p.parent?.name ?? null,
    derivedType: p.derivedType, derivedDirection: p.derivedDirection, derivedValue: p.derivedValue, derivedRounding: p.derivedRounding,
    directChannelEnabled: p.directChannelEnabled,
  });
  const dependents = ratePlans
    .filter((p) => p.priceLogic === "derived" && p.parentRatePlanId === rp.id)
    .map((p) => ({ id: p.id, name: p.name, offset: offsetOf(p, money) }));
  const rooms = roomTypes.filter((r) => rp.roomTypeLinks.some((l) => l.roomTypeId === r.id));
  const pricing = {
    id: rp.id, name: rp.name, active: rp.active,
    pricingModel: rp.pricingModel, primaryOccupancy: rp.primaryOccupancy,
    // The smallest cap among the rooms it sells: a plan cannot price a party its narrowest room
    // cannot hold, so that room — not the largest — sets the ceiling.
    ceiling: Math.min(50, ...(rp.roomTypeLinks.length > 0 ? rp.roomTypeLinks.map((l) => Math.max(1, l.roomType.maxGuests)) : [1])),
    roomCount: rp._count.roomTypeLinks,
  };
  const base = `/rooms-rates/plans/${rp.id}`;

  return (
    <>
      <BackLink href="/rooms-rates/plans">{s.plans.back}</BackLink>
      <BlockedNotice name={blocked} text={blocked ? s.blocked(blocked) : undefined} />
      <div>
        <h2 className="text-[18px] font-bold tracking-tight text-ink-900">
          {rp.name}
          {!rp.active && <span className="ml-2 align-middle text-[10.5px] font-bold uppercase text-ink-400">{s.inactive}</span>}
        </h2>
        <p className="text-[12px] text-ink-500">
          {rp.code} · {rp.mealPlan?.name ?? s.plans.roomOnly}{rp.cancellationPolicy ? ` · ${rp.cancellationPolicy.name}` : ""}
          {rp.priceLogic === "derived" && rp.parent ? s.plans.pricedFrom(rp.parent.name, offsetOf(rp, money)) : ""}
        </p>
      </div>

      <LinkTabs
        label={s.plans.tabsLabel(rp.name)}
        tabs={[
          { href: base, label: s.plans.tabs.plan, active: tab === "plan" },
          { href: `${base}?tab=price`, label: s.plans.tabs.price, active: tab === "price" },
          { href: `${base}?tab=rooms`, label: s.plans.tabs.rooms, active: tab === "rooms", badge: String(rooms.length) },
        ]}
      />

      {tab === "plan" && (
        <>
          <RatePlanEditor key={rp.id} ratePlan={rp} />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
            <p className="text-[12px] text-ink-500">
              {s.plans.deleteText}
            </p>
            <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note={s.plans.deleteNote} />
          </div>
        </>
      )}

      {tab === "price" && (
        <>
          <PlanLinkageCard plan={toLink(rp)} options={ratePlans.map(toLink)} dependents={dependents} />
          <PlanPricingCard plan={pricing} propertyModel={propertyModel} />
        </>
      )}

      {tab === "rooms" && (
        <Card>
          <CardHeader title={s.plans.roomsTitle} subtitle={s.plans.roomsSubtitle} />
          <div className="px-5 pb-5">
            {rooms.length === 0 ? (
              <p className="text-[13px] text-ink-500">{s.plans.roomsEmpty}</p>
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
      )}
    </>
  );
}
