import { getChannels } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ChannelSettingsDialog, AddChannelDialog } from "@/components/channels/ChannelDialogs";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const INITIALS: Record<string, string> = { booking: "B", expedia: "E", trip: "T", agoda: "A" };

export default async function ChannelsPage() {
  const { channels, mapStats } = await getChannels();
  const statById = Object.fromEntries(mapStats.map((m) => [m.channelId, m]));

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle="Connected OTAs, mapping health and per-channel settings"
        action={<AddChannelDialog connectedCodes={channels.map((c) => c.code)} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {channels.map((ch) => {
          const m = statById[ch.id];
          const pct = m ? Math.round((m.complete / m.total) * 100) : 0;
          return (
            <Card key={ch.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-[17px] font-bold text-brand-700">{INITIALS[ch.code] ?? ch.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-ink-900">{ch.name}</h3>
                    <StatusPill tone="success">Connected</StatusPill>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-400">
                    {ch.currency} · {ch.commissionPct}% commission · synced {relativeTime(ch.lastSyncAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {ch.errorCount > 0 && <StatusPill tone="danger">{ch.errorCount} error</StatusPill>}
                  <ChannelSettingsDialog channel={ch} />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-ink-500">
                  <span>Mapping completeness</span>
                  <span className="tnum text-ink-700">{pct}% · {m?.complete}/{m?.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div className={`h-full rounded-full ${pct >= 98 ? "bg-success-500" : pct >= 90 ? "bg-warning-500" : "bg-danger-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-surface-muted py-2">
                  <div className="tnum text-[15px] font-bold text-ink-900">{ch.pendingCount}</div>
                  <div className="text-[10.5px] font-medium text-ink-400">Pending</div>
                </div>
                <div className="rounded-md bg-surface-muted py-2">
                  <div className="tnum text-[15px] font-bold text-ink-900">{ch.supportedRestrictions.length}</div>
                  <div className="text-[10.5px] font-medium text-ink-400">Restrictions</div>
                </div>
                <div className="rounded-md bg-surface-muted py-2">
                  <div className="tnum text-[15px] font-bold text-ink-900">{ch.markupPct}%</div>
                  <div className="text-[10.5px] font-medium text-ink-400">FX markup</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
