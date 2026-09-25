import Link from "next/link";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { getRatesData } from "@/lib/data";
import { RatePlanDialog } from "@/components/rates/RatePlanDialog";
import { BlockedNotice } from "@/components/rates/BlockedNotice";
import { offsetOf } from "@/components/rates/plan-labels";
import { moneyIn } from "@/lib/i18n/money";
import { Card, CardHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { rates as ratesDict } from "@/lib/i18n/rates";

export const dynamic = "force-dynamic";

type Plan = Awaited<ReturnType<typeof getRatesData>>["ratePlans"][number];

/**
 * Rate plans as a tree: each derived plan indented under the plan it takes its price from, with its
 * offset. That replaces the old separate Linkage card — the linkage is read in the list itself.
 */
export default async function RatePlansPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const { ratePlans, defaults } = await getRatesData();
  const { t, locale } = await i18n();
  const s = t(ratesDict);
  const money = moneyIn(locale);
  const propertyModel = defaults?.pricingModel ?? "per_room";
  const ids = new Set(ratePlans.map((p) => p.id));
  // A derived plan whose parent is gone is still listed — at the top, never lost.
  const roots = ratePlans.filter((p) => p.priceLogic !== "derived" || !p.parentRatePlanId || !ids.has(p.parentRatePlanId));
  const childrenOf = (id: string) => ratePlans.filter((p) => p.priceLogic === "derived" && p.parentRatePlanId === id);

  const rows: { plan: Plan; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (p: Plan, depth: number) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    rows.push({ plan: p, depth });
    for (const c of childrenOf(p.id)) walk(c, depth + 1);
  };
  roots.forEach((r) => walk(r, 0));
  for (const p of ratePlans) if (!seen.has(p.id)) walk(p, 0);

  return (
    <>
      <BlockedNotice name={blocked} text={blocked ? s.blocked(blocked) : undefined} />
      <Card>
        <CardHeader
          title={s.plans.title}
          subtitle={s.plans.subtitle}
          action={<RatePlanDialog parents={ratePlans.map((p) => ({ id: p.id, name: p.name }))} />}
        />
        {rows.length === 0 ? (
          <p className="px-5 pb-8 pt-2 text-[13px] text-ink-500">{s.plans.empty}</p>
        ) : (
          <ul className="divide-y divide-surface-border/70 border-t border-surface-border/70">
            {rows.map(({ plan, depth }) => {
              const model = plan.pricingModel ?? propertyModel;
              return (
                <li key={plan.id}>
                  <Link
                    href={`/rooms-rates/plans/${plan.id}`}
                    className="flex items-center gap-2 py-3 pr-5 transition-colors hover:bg-surface-muted"
                    style={{ paddingLeft: `${20 + Math.min(depth, 4) * 22}px` }}
                  >
                    {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`truncate text-[13.5px] font-semibold ${plan.active ? "text-ink-900" : "text-ink-400"}`}>{plan.name}</span>
                        {depth > 0 && <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{offsetOf(plan, money)}</span>}
                        {!plan.active && <span className="text-[10px] font-bold uppercase text-ink-400">{s.inactive}</span>}
                        {!plan.directChannelEnabled && (
                          <span title={s.plans.otaOnlyTitle} className="rounded bg-surface-sunken px-1 py-0.5 text-[9.5px] font-bold uppercase text-ink-500">{s.plans.otaOnly}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-500">
                        {plan.code} · {s.pricingModel[model as "per_room"] ?? model} · {s.plans.roomTypes(plan._count.roomTypeLinks)}
                        {plan.priceLogic === "derived" && plan.parent ? s.plans.from(plan.parent.name) : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-surface-border/60 px-5 py-2.5 text-[11.5px] text-ink-400">
          {s.plans.footer}
        </p>
      </Card>
    </>
  );
}
