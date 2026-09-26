import { ChevronDown } from "lucide-react";
import { getRoomsAndRates } from "@/lib/data";
import { prisma } from "@/lib/db";
import { deleteRatePlan, deleteRoomType } from "@/lib/actions";
import { StatusPill, PageHeader } from "@/components/ui/primitives";
import { RoomTypeDialog } from "@/components/rooms/RoomTypeDialog";
import { RatePlanDialog } from "@/components/rooms/RatePlanDialog";
import { RatePlanLinkageBoard } from "@/components/rooms/RatePlanLinkageBoard";
import { CollapseAll } from "@/components/calendar/CollapseAll";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { i18n } from "@/lib/i18n/server";
import { rooms as roomsDict, type CmRoomsStrings } from "@/lib/i18n/rooms";

export const dynamic = "force-dynamic";

function derivedLabel(s: CmRoomsStrings, money: (minor: number) => string, rp: { derivedType: string | null; derivedDirection: string | null; derivedValue: number | null; parent: { name: string } | null }) {
  if (!rp.derivedType) return null;
  const sign = rp.derivedDirection === "increase" ? "+" : "−";
  const amount = rp.derivedType === "percent" ? `${rp.derivedValue}%` : money(rp.derivedValue ?? 0);
  return `${rp.parent?.name ?? s.plans.parent} ${sign}${amount}`;
}

function restrictionLabel(s: CmRoomsStrings, rp: { defMinLos: number | null; defMaxLos: number | null; defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null }) {
  const parts: string[] = [];
  if (rp.defMinLos) parts.push(s.plans.minStay(rp.defMinLos));
  if (rp.defMaxLos) parts.push(s.plans.maxStay(rp.defMaxLos));
  if (rp.defAdvancePurchaseMin != null) parts.push(s.plans.bookAtLeast(rp.defAdvancePurchaseMin));
  if (rp.defAdvancePurchaseMax != null) parts.push(s.plans.bookAtMost(rp.defAdvancePurchaseMax));
  return parts.length ? parts.join(" · ") : null;
}

/** A collapsible section shell — the vertical restack (spec §4.1): rooms on top, rate plans below,
 *  each collapsible with a single Expand/Collapse-all control. */
function Section({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <details open className="group/section overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      <summary className="flex cursor-pointer select-none items-center gap-3 border-b border-surface-border bg-surface-muted/60 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400 transition-transform group-open/section:rotate-0" />
        <span className="text-[14px] font-bold tracking-tight text-ink-900">{title}</span>
        <span className="text-[11.5px] font-medium text-ink-400">{count}</span>
      </summary>
      {children}
    </details>
  );
}

export default async function RoomsRatesPage({ searchParams }: { searchParams: Promise<{ blocked?: string; kind?: string }> }) {
  const { blocked, kind } = await searchParams;
  const [{ property, roomTypes, ratePlans }, { t, money }] = await Promise.all([getRoomsAndRates(), i18n()]);
  const s = t(roomsDict);
  const fmt = (minor: number) => money(minor, property.baseCurrency);
  const parents = ratePlans.map((rp) => ({ id: rp.id, name: rp.name }));

  // Which rate plans are assigned to each room type (spec §4.1: expanding a room shows its plans).
  const links = await prisma.ratePlanRoomType.findMany({
    where: { roomType: { propertyId: property.id } },
    select: { roomTypeId: true, ratePlan: { select: { name: true, active: true } } },
  });
  const plansByRoom = new Map<string, string[]>();
  for (const l of links) {
    if (!l.ratePlan.active) continue;
    const arr = plansByRoom.get(l.roomTypeId) ?? [];
    arr.push(l.ratePlan.name);
    plansByRoom.set(l.roomTypeId, arr);
  }

  const linkPlans = ratePlans.map((rp) => ({
    id: rp.id, name: rp.name, priceLogic: rp.priceLogic, active: rp.active,
    parentRatePlanId: rp.parentRatePlanId, parentName: rp.parent?.name ?? null,
    derivedType: rp.derivedType, derivedDirection: rp.derivedDirection, derivedValue: rp.derivedValue, derivedRounding: rp.derivedRounding,
    directChannelEnabled: rp.directChannelEnabled,
  }));

  return (
    <div>
      <PageHeader
        title={s.title}
        subtitle={s.subtitle}
        action={<CollapseAll containerId="rr-sections" />}
      />

      {blocked && (
        <div className="mb-4 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
          {s.blocked(blocked, kind === "room" ? "room" : "plan")[0]}
          <a href="/mapping" className="font-semibold underline">{s.blocked(blocked, "room")[1]}</a>{s.blocked(blocked, "room")[2]}
        </div>
      )}

      {/* Vertical stack (spec §4.1): Rooms on top, Rate plans below, Linkage last — each collapsible. */}
      <div id="rr-sections" className="space-y-4">
        <Section title={s.rooms.title} count={s.rooms.count(roomTypes.length)}>
          <div className="flex justify-end px-4 py-2.5"><RoomTypeDialog /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {Object.values(s.rooms.cols).map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {roomTypes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-ink-400">
                      {s.rooms.empty}
                    </td>
                  </tr>
                )}
                {roomTypes.map((rt) => (
                  <tr key={rt.id} className="group border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{rt.name}</td>
                    <td className="px-4 py-2.5 text-ink-500">{rt.code}</td>
                    <td className="px-4 py-2.5 text-ink-600">{s.unitKinds[rt.unitKind as keyof typeof s.unitKinds] ?? rt.unitKind}</td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{rt.totalRooms}</td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{rt.maxGuests}</td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{(plansByRoom.get(rt.id) ?? []).join(", ") || "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={rt.active ? "success" : "neutral"}>{rt.active ? s.active : s.inactivePill}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <RoomTypeDialog roomType={rt} />
                        <DeleteButton action={deleteRoomType} id={rt.id} label={rt.name} note={s.rooms.deleteNote} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={s.plans.title} count={s.plans.count(ratePlans.length)}>
          <div className="flex justify-end px-4 py-2.5"><RatePlanDialog parents={parents} /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {Object.values(s.plans.cols).map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {ratePlans.map((rp) => (
                  <tr key={rp.id} className="group border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-ink-900">{rp.priceLogic === "derived" && <span title={s.plans.derivedFrom(rp.parent?.name ?? s.plans.parent)} className="mr-1 select-none">📎</span>}{rp.name}{!rp.active && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">{s.inactive}</span>}</div>
                      <div className="text-[11px] text-ink-400">{rp.code} · {s.plans.rooms(rp._count.roomTypeLinks)} · {rp.mealPlan?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2.5"><StatusPill tone={rp.priceLogic === "derived" ? "info" : "neutral"}>{s.plans.logic[rp.priceLogic as keyof typeof s.plans.logic] ?? rp.priceLogic}</StatusPill></td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-600">
                      {derivedLabel(s, fmt, rp) ?? s.plans.manualEntry}
                      {restrictionLabel(s, rp) && <div className="mt-0.5 text-[10.5px] text-ink-400">{restrictionLabel(s, rp)}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {rp.tags.map((tg) => <span key={tg} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-500">{tg}</span>)}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <RatePlanDialog ratePlan={rp} parents={parents.filter((p) => p.id !== rp.id)} />
                        <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note={s.plans.deleteNote} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Editable Rate Plan Linkage (spec §4.2). */}
        <Section title={s.linkageSection.title} count={s.linkageSection.count}>
          <RatePlanLinkageBoard plans={linkPlans} />
        </Section>
      </div>

      <p className="mt-3 text-[12px] text-ink-400">
        {s.footer}
      </p>
    </div>
  );
}
