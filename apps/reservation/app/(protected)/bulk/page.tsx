import { getRatesData } from "@/lib/data";
import { deleteRestrictionRule } from "@/lib/actions-rates";
import { CrsBulkForm } from "@/components/rates/CrsBulkForm";
import { RestrictionDialog } from "@/components/rates/RestrictionDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { PRECEDENCE_LINE } from "@revio/core";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct", ota: "OTA", gds: "GDS", call_center: "Call Center", corporate: "Corporate", travel_agent: "Travel Agent",
};

/** Bulk Rates & Availability (spec §3.7) — date-scoped ARI: the CRS twin of RevioLink's bulk
 * screen, with open/close added. Standing restriction RULES live here too (moved from the
 * dissolved Rates & Restrictions screen), keeping their source-level targeting. */
export default async function BulkPage() {
  const { property, ratePlans, rules, roomTypes, channels } = await getRatesData();
  const rtName = new Map(roomTypes.map((r) => [r.id, r.name]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bulk Rates & Availability"
        subtitle={`${property.name} · date-scoped rate, restriction and open/close edits in one operation`}
      />

      <Card>
        <CardHeader title="Bulk update" subtitle="One run = one audit entry + one push to the connected channel manager" />
        <CrsBulkForm
          roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name }))}
          ratePlans={ratePlans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceLogic: p.priceLogic, parentName: p.parent?.name ?? null }))}
          today={today}
        />
      </Card>

      <Card>
        <CardHeader
          title="Restriction Rules"
          subtitle="Date-scoped, source-targetable standing rules — e.g. closed to Travel Agents over a trade fair"
          action={<RestrictionDialog roomTypes={roomTypes} channels={channels} />}
        />
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

      <p className="text-[12px] text-ink-400">
        Precedence (two-tier): {PRECEDENCE_LINE}.
      </p>
    </div>
  );
}
