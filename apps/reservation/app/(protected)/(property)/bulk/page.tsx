import Link from "next/link";
import { getRatesData } from "@/lib/data";
import { deleteRestrictionRule } from "@/lib/actions-rates";
import { CrsBulkPanel } from "@/components/rates/CrsBulkPanel";
import { RestrictionDialog } from "@/components/rates/RestrictionDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { PRECEDENCE_LINE, resolveMainGuestCount } from "@revio/core";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  direct: "Direct", ota: "OTA", gds: "GDS", call_center: "Call Center", corporate: "Corporate", travel_agent: "Travel Agent",
};

/** Bulk Rates & Availability (spec §3.7) — date-scoped ARI: the CRS twin of RevioLink's bulk
 * screen, with open/close added. Standing restriction RULES live here too (moved from the
 * dissolved Rates & Restrictions screen), keeping their source-level targeting. */
export default async function BulkPage({ searchParams }: { searchParams: Promise<{ rt?: string }> }) {
  const { rt } = await searchParams;
  const { property, ratePlans, rules, defaults, roomTypes, channels } = await getRatesData();
  // Whether the Price control is a single field or an occupancy matrix (OBP §6.4).
  const perPerson = (defaults?.pricingModel ?? "per_room") === "per_person";
  // Inline per-row bulk from the Inventory Calendar pre-scopes to one room type (?rt=CODE) —
  // the SAME code path and audit trail, never a parallel implementation (spec §3.5).
  const preselect = rt ? roomTypes.filter((r) => r.code === rt).map((r) => r.id) : undefined;
  const rtName = new Map(roomTypes.map((r) => [r.id, r.name]));
  const today = new Date().toISOString().slice(0, 10);
  // The party size the headline price is for. Set in Settings; when nobody has set it, derived from
  // the rooms — weighted by how many of each exist — rather than read off whichever room sorted
  // first, which anchored a hotel of forty doubles on a single. A derived number is labelled
  // "assumed" downstream, so an unanswered question never reads as a decision.
  const mainGuests = resolveMainGuestCount(defaults?.mainGuestCount ?? null, roomTypes);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bulk Rates & Availability"
        subtitle={`${property.name} · date-scoped rate, restriction and open/close edits in one operation`}
      />

      <Card surface="flat">
        <CardHeader surface="flat" title="Bulk update" subtitle="One run, one entry in the audit log, sent once to your channel manager" />
        {roomTypes.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-400">
            A bulk update changes rates and restrictions across your room types — so you need at least one first.{" "}
            <Link href="/rooms-rates" className="font-semibold text-brand-600 hover:underline">Add a room type</Link>.
          </p>
        ) : (
        <CrsBulkPanel
          {...(preselect && preselect.length > 0 ? { preselectRoomTypeIds: preselect } : {})}
          roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name, maxGuests: r.maxGuests }))}
          perPerson={perPerson}
          primaryOccupancy={mainGuests.value}
          primaryOccupancyNote={mainGuests.note}
          ratePlans={ratePlans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceLogic: p.priceLogic, parentName: p.parent?.name ?? null }))}
          today={today}
        />
        )}
      </Card>

      <Card surface="flat">
        <CardHeader surface="flat"
          title="Your active restriction rules"
          subtitle="Standing rules for a date range, optionally aimed at one booking source — for example, closed to travel agents during a trade fair"
          action={<RestrictionDialog roomTypes={roomTypes} channels={channels} />}
        />
        {rules.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">No rules yet — add one to apply a restriction across a range of dates.</div>
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
        Which setting wins: {PRECEDENCE_LINE}.
      </p>
    </div>
  );
}
