import { getRatesData } from "@/lib/data";
import { deleteRatePlan, deleteRestrictionRule, savePropertyDefaults } from "@/lib/actions-rates";
import { RatePlanDialog } from "@/components/rates/RatePlanDialog";
import { RestrictionDialog } from "@/components/rates/RestrictionDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct", ota: "OTA", gds: "GDS", call_center: "Call Center", corporate: "Corporate", travel_agent: "Travel Agent",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

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

export default async function RatesPage() {
  const { property, ratePlans, rules, defaults, roomTypes, channels } = await getRatesData();
  const parents = ratePlans.map((rp) => ({ id: rp.id, name: rp.name }));
  const rtName = new Map(roomTypes.map((r) => [r.id, r.name]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rates & Restrictions"
        subtitle={`${property.name} · the same shared rate engine RevioLink pushes to channels — one truth, two products`}
      />

      <Card>
        <CardHeader title="Rate Plans" action={<RatePlanDialog parents={parents} />} />
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
                    <div className="font-semibold text-ink-900">{rp.name}{!rp.active && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">inactive</span>}</div>
                    <div className="text-[11px] text-ink-400">{rp.code} · {rp._count.roomTypeLinks} rooms · {rp.mealPlan?.name ?? "room only"}</div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={rp.priceLogic === "derived" ? "info" : "neutral"}>{rp.priceLogic}</StatusPill></td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{derivedLabel(rp) ?? "Manual entry"}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{rp.cancellationPolicy?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-500">{restrictionLabel(rp) ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RatePlanDialog ratePlan={rp} parents={parents.filter((p) => p.id !== rp.id)} />
                      <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note="Plans in use are deactivated instead." />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Daily prices are edited on the Inventory Calendar (Rate line) or in RevioLink; derived plans recalculate from
          their parent automatically.
        </p>
      </Card>

      <Card>
        <CardHeader title="Restriction Rules" action={<RestrictionDialog roomTypes={roomTypes} channels={channels} />} />
        {rules.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">No rules yet — rules override rate-plan and property defaults for their date range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {["Rule", "Type", "Dates", "Room", "Sources", "Value", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{r.name}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={r.type === "stop_sell" ? "danger" : "info"}>{r.type.replace(/_/g, " ")}</StatusPill></td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{r.dateFrom.toISOString().slice(0, 10)} → {r.dateTo.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-ink-600">{r.roomTypeId ? rtName.get(r.roomTypeId) ?? "?" : "All"}</td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-500">
                      {r.sourceCategories.length === 0 ? "All sources" : r.sourceCategories.map((c) => SOURCE_LABEL[c] ?? c).join(", ")}
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-700">{r.valueInt ?? (r.valueBool ? "on" : "—")}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={r.active ? "success" : "neutral"}>{r.active ? "active" : "off"}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <RestrictionDialog rule={r} roomTypes={roomTypes} channels={channels} />
                        <DeleteButton action={deleteRestrictionRule} id={r.id} label={r.name} note="Dates covered by this rule fall back to the plan/property defaults." />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Property defaults — the level-4 fallback" />
        <form action={savePropertyDefaults} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-4">
          <div><label className={labelCls}>Min stay (nights)</label><input type="number" name="defMinLos" min={0} defaultValue={defaults?.defMinLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Max stay (nights)</label><input type="number" name="defMaxLos" min={0} defaultValue={defaults?.defMaxLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≥ days ahead</label><input type="number" name="defAdvancePurchaseMin" min={0} defaultValue={defaults?.defAdvancePurchaseMin ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≤ days ahead</label><input type="number" name="defAdvancePurchaseMax" min={0} defaultValue={defaults?.defAdvancePurchaseMax ?? ""} placeholder="—" className={inputCls} /></div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defStopSell" defaultChecked={defaults?.defStopSell ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Stop sell
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCta" defaultChecked={defaults?.defCta ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to arrival
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCtd" defaultChecked={defaults?.defCtd ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to departure
          </label>
          <div><label className={labelCls}>Hold TTL (minutes)</label><input type="number" name="holdTtlMinutes" min={5} max={240} defaultValue={defaults?.holdTtlMinutes ?? 30} className={inputCls} /></div>
          <div className="col-span-2 flex items-center justify-between lg:col-span-4">
            <p className="text-[11.5px] text-ink-400">
              Priority: manual calendar edit → restriction rule → rate-plan default → <span className="font-semibold text-ink-600">these</span>.
            </p>
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save defaults</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
