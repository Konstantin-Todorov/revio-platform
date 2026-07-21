import { CalendarOff } from "lucide-react";
import { getRatesData, getSetupData } from "@/lib/data";
import { deleteRatePlan } from "@/lib/actions-rates";
import { deleteInventoryPeriod } from "@/lib/actions-inventory";
import { RatePlanDialog } from "@/components/rates/RatePlanDialog";
import { RatePlanLinkageBoard } from "@/components/rates/RatePlanLinkageBoard";
import { PeriodDialog } from "@/components/inventory/PeriodDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = "force-dynamic";

function derivedLabel(rp: { derivedType: string | null; derivedDirection: string | null; derivedValue: number | null; parent: { name: string } | null }) {
  if (!rp.derivedType) return null;
  const sign = rp.derivedDirection === "increase" ? "+" : "−";
  const amount = rp.derivedType === "percent" ? `${rp.derivedValue}%` : `€${(rp.derivedValue ?? 0) / 100}`;
  return `${rp.parent?.name ?? "parent"} ${sign}${amount}`;
}

function restrictionLabel(rp: { defMinLos: number | null; defMaxLos: number | null; defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null }) {
  const parts: string[] = [];
  if (rp.defMinLos) parts.push(`min ${rp.defMinLos}n`);
  if (rp.defMaxLos) parts.push(`max ${rp.defMaxLos}n`);
  if (rp.defAdvancePurchaseMin != null) parts.push(`book ≥${rp.defAdvancePurchaseMin}d ahead`);
  if (rp.defAdvancePurchaseMax != null) parts.push(`book ≤${rp.defAdvancePurchaseMax}d ahead`);
  return parts.length ? parts.join(" · ") : null;
}

/** Rooms & Rates (spec §3.6) — the single product-definition surface: what the property sells and
 * how much of it exists. Absorbs the old Rates & Restrictions plan section and ALL of Inventory
 * Setup. One-record rule: these are the SAME shared-core records RevioLink authors — two edit
 * surfaces, never two tables that sync. */
export default async function RoomsRatesPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const [{ property, ratePlans }, { roomTypes, periods, todayIso }] = await Promise.all([getRatesData(), getSetupData()]);
  const parents = ratePlans.map((rp) => ({ id: rp.id, name: rp.name }));
  const linkPlans = ratePlans.map((rp) => ({
    id: rp.id, name: rp.name, priceLogic: rp.priceLogic, active: rp.active,
    parentRatePlanId: rp.parentRatePlanId, parentName: rp.parent?.name ?? null,
    derivedType: rp.derivedType, derivedDirection: rp.derivedDirection, derivedValue: rp.derivedValue, derivedRounding: rp.derivedRounding,
    directChannelEnabled: rp.directChannelEnabled,
  }));
  const activePeriod = (p: (typeof periods)[number]) => p.dateTo.toISOString().slice(0, 10) >= todayIso;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms & Rates"
        subtitle={`${property.name} · product definitions — the same shared-core records RevioLink edits (one record, two windows)`}
      />

      {blocked && (
        <div className="rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
          “{blocked}” is mapped to the channel manager and can’t be deleted — unmap it in RevioLink → Mapping first.
        </div>
      )}

      <Card>
        <CardHeader title="Room types & physical counts" subtitle="Physical count is the cap & safety net — rooms-to-sell is managed per date on the calendar" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Room type</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Unit</th>
                <th className="px-4 py-2.5 text-right">Physical count</th>
                <th className="px-4 py-2.5 text-right">Max guests</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{rt.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-500">{rt.code}</td>
                  <td className="px-4 py-2.5 text-ink-500">{rt.unitKind}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{rt.totalRooms}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-500">{rt.maxGuests}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={rt.active ? "success" : "neutral"}>{rt.active ? "active" : "inactive"}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rate Plans" subtitle="Per-plan defaults (min-stay, advance purchase) are the rate-plan tier of the precedence model" action={<RatePlanDialog parents={parents} />} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Rate Plan", "Type", "Pricing", "Policy", "Defaults"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((rp) => (
                <tr key={rp.id} className="group border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink-900">
                      {rp.priceLogic === "derived" && <span title={`Derived from ${rp.parent?.name ?? "parent"}`} className="mr-1 select-none">📎</span>}
                      {rp.name}
                      {!rp.active && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">inactive</span>}
                      {!rp.directChannelEnabled && <span title="Not bookable on the direct channel" className="ml-1.5 rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-bold uppercase text-ink-400">OTA/corp</span>}
                    </div>
                    <div className="text-[11px] text-ink-400">{rp.code} · {rp._count.roomTypeLinks} rooms · {rp.mealPlan?.name ?? "room only"}</div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={rp.priceLogic === "derived" ? "info" : "neutral"}>{rp.priceLogic}</StatusPill></td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{derivedLabel(rp) ?? "Manual entry"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{rp.cancellationPolicy?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{restrictionLabel(rp) ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RatePlanDialog ratePlan={rp} parents={parents.filter((p) => p.id !== rp.id)} />
                      <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note="Mapped plans must be unmapped in RevioLink first; plans in use are deactivated instead." />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Daily prices live on the Inventory Calendar (Rate line) or Bulk Rates &amp; Availability; derived plans
          recalculate from their parent automatically.
        </p>
      </Card>

      {/* Editable Rate Plan Linkage (CRS-REFINEMENT-R2 §6). */}
      <Card>
        <CardHeader title="Rate Plan Linkage" subtitle="Derived-pricing chains — change a parent or offset, or switch a plan between manual and derived" />
        <RatePlanLinkageBoard plans={linkPlans} />
      </Card>

      <Card>
        <CardHeader
          title="Out-of-order & closure periods"
          subtitle="Commercial closures are a CRS decision; with a PMS, out-of-order originates there and the CRS reads it"
          action={<PeriodDialog roomTypes={roomTypes.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, totalRooms: r.totalRooms }))} todayIso={todayIso} />}
        />
        {periods.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-5 text-[13px] text-ink-500">
            <CalendarOff className="h-4 w-4" /> No periods — add one when rooms go under maintenance or a wing closes seasonally.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {["Room type", "Kind", "From", "To", "Units", "Note", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="border-b border-surface-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{p.roomType.name}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={p.kind === "closure" ? "info" : "warning"}>{p.kind === "closure" ? "closure" : "out of order"}</StatusPill>
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{p.dateFrom.toISOString().slice(0, 10)}</td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{p.dateTo.toISOString().slice(0, 10)}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{p.rooms}</td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-500">{p.note ?? "—"}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={activePeriod(p) ? "success" : "neutral"}>{activePeriod(p) ? "current" : "past"}</StatusPill></td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteButton action={deleteInventoryPeriod} id={p.id} label={`${p.roomType.name} ${p.kind === "closure" ? "closure" : "out-of-order"} period`} note="Availability for these dates restores immediately." />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
