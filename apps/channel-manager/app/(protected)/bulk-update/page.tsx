import { getRoomsAndRates, getRestrictions } from "@/lib/data";
import { deleteRestrictionRule } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { BulkUpdateForm } from "@/components/bulk/BulkUpdateForm";
import { RestrictionDialog } from "@/components/restrictions/RestrictionDialog";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ymd } from "@/lib/format";
import { channelSupports } from "@revio/core";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  min_los: "Min LOS", max_los: "Max LOS", stop_sell: "Stop Sell", cta: "Closed to Arrival",
  ctd: "Closed to Departure", advance_purchase_min: "Adv. Purchase min", advance_purchase_max: "Adv. Purchase max",
};

/** V2 IA: Bulk Update and Restrictions are ONE screen — one-off mass edits on top, standing rules below. */
export default async function Page({ searchParams }: { searchParams: Promise<{ rt?: string }> }) {
  const { rt } = await searchParams;
  const [{ roomTypes, ratePlans }, { rules, channels }] = await Promise.all([getRoomsAndRates(), getRestrictions()]);
  // Capability flags (spec §3.3 / §5.2): a rule aimed at a channel that can't honour its type is
  // flagged here, not silently created — and it is a limitation, never an error.
  const ignoredBy = (rule: { type: string; channelCodes: string[] }): string[] => {
    const targets = rule.channelCodes.length > 0 ? channels.filter((c) => rule.channelCodes.includes(c.code)) : channels;
    return targets.filter((c) => !channelSupports(c.supportedRestrictions, rule.type as Parameters<typeof channelSupports>[1])).map((c) => c.name);
  };
  // Inline per-row bulk from the calendar pre-scopes to one room type (?rt=CODE).
  const preselect = rt ? roomTypes.filter((r) => r.code === rt).map((r) => r.id) : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const rtOpts = roomTypes.map((r) => ({ id: r.id, name: r.name }));
  const chOpts = channels.map((c) => ({ code: c.code, name: c.name }));

  return (
    <div>
      <PageHeader title="Bulk Rates & Restrictions" subtitle="Mass edits across dates and rooms, plus the standing restriction rules" />
      <BulkUpdateForm
        roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name, code: r.code }))}
        ratePlans={ratePlans.map((p) => ({ id: p.id, name: p.name, priceLogic: p.priceLogic, parentName: p.parent?.name ?? null }))}
        today={today}
        {...(preselect ? { preselect } : {})}
      />

      <Card className="mt-4">
        <CardHeader title="Restriction Rules" action={<RestrictionDialog roomTypes={rtOpts} channels={chOpts} />} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Rule", "Type", "Applies to", "Date range", "Channels", "Value", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{r.name}</td>
                  <td className="px-4 py-2.5"><StatusPill tone="info">{TYPE_LABEL[r.type] ?? r.type}</StatusPill></td>
                  <td className="px-4 py-2.5 text-ink-600">{r.roomTypeName}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{ymd(r.dateFrom)} → {ymd(r.dateTo)}</td>
                  <td className="px-4 py-2.5 text-ink-500">
                    {r.channelCodes.length === channels.length ? "All" : r.channelCodes.join(", ")}
                    {ignoredBy(r).length > 0 && (
                      <span title="These channels don't support this restriction type — the rule is skipped for them (a limitation, not an error)." className="ml-1.5 rounded bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-warning-700">
                        ignored by {ignoredBy(r).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{r.valueInt ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</StatusPill></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RestrictionDialog rule={r} roomTypes={rtOpts} channels={chOpts} />
                      <DeleteButton action={deleteRestrictionRule} id={r.id} label={r.name} />
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px] text-ink-400">No standing rules yet — add one to apply a restriction across a date range and channels.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-ink-400">
        Precedence resolved by <span className="font-semibold text-ink-500">@revio/core</span> (two-tier):
        date-scoped edit (calendar or bulk — most recent wins) &gt; restriction rule &gt; rate-plan default &gt;
        property default.
      </p>
    </div>
  );
}
