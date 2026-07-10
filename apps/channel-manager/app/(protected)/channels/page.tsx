import { Download } from "lucide-react";
import { getChannels } from "@/lib/data";
import { pullChannelBookings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ChannelSettingsDialog, AddChannelDialog } from "@/components/channels/ChannelDialogs";
import {
  PauseChannelButton, ResumeChannelButton, DisconnectChannelButton, ReconnectChannelButton, FullSyncButton,
} from "@/components/channels/ChannelActions";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<string, string> = { mock: "Mock", channex_sandbox: "Channex · sandbox", channex_prod: "Channex · prod" };

// Brand marks, self-contained (no external assets): initial on the OTA's brand colour.
const LOGO: Record<string, { initial: string; bg: string; fg: string }> = {
  booking: { initial: "B", bg: "#003580", fg: "#ffffff" },
  expedia: { initial: "E", bg: "#191e3b", fg: "#fddb32" },
  trip: { initial: "T", bg: "#287dfa", fg: "#ffffff" },
  agoda: { initial: "a", bg: "#5c2d91", fg: "#ffffff" },
};

function ChannelLogo({ code, name }: { code: string; name: string }) {
  const l = LOGO[code];
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-lg text-[19px] font-black"
      style={l ? { backgroundColor: l.bg, color: l.fg } : undefined}
    >
      {l?.initial ?? name[0]}
    </span>
  );
}

const STATUS_PILL: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  connected: { tone: "success", label: "Connected" },
  paused: { tone: "warning", label: "Paused" },
  error: { tone: "danger", label: "Error" },
  disconnected: { tone: "neutral", label: "Disconnected" },
};

export default async function ChannelsPage() {
  const { channels, mapStats } = await getChannels();
  const statById = Object.fromEntries(mapStats.map((m) => [m.channelId, m]));
  const active = channels.filter((c) => c.status !== "disconnected");
  const dormant = channels.filter((c) => c.status === "disconnected");

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle="Connected OTAs, mapping health and per-channel settings"
        action={<AddChannelDialog connectedCodes={channels.map((c) => c.code)} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {active.map((ch) => {
          const m = statById[ch.id];
          const pct = m ? Math.round((m.complete / m.total) * 100) : 0;
          return (
            <Card key={ch.id} className="p-4">
              <div className="flex items-start gap-3">
                <ChannelLogo code={ch.code} name={ch.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-ink-900">{ch.name}</h3>
                    <StatusPill tone={STATUS_PILL[ch.status]?.tone ?? "neutral"}>{STATUS_PILL[ch.status]?.label ?? ch.status}</StatusPill>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-400">
                    {ch.currency} · {ch.commissionPct}% commission · last push {relativeTime(ch.lastSyncAt)}
                  </div>
                  <div className="mt-1">
                    <StatusPill tone={ch.connectivityMode === "mock" ? "neutral" : "info"}>{MODE_LABEL[ch.connectivityMode] ?? ch.connectivityMode}</StatusPill>
                  </div>
                </div>
                {/* Quick actions (spec §3.5): Sync · Pull · Pause/Resume, with Disconnect separated
                    so it can't be hit by accident. All confirmed + audited per channel. */}
                <div className="flex items-center gap-1">
                  {ch.errorCount > 0 && <StatusPill tone="danger">{ch.errorCount} error</StatusPill>}
                  {ch.status !== "paused" && <FullSyncButton channelId={ch.id} channelName={ch.name} />}
                  <form action={pullChannelBookings}>
                    <input type="hidden" name="channelId" value={ch.id} />
                    <button type="submit" aria-label="Pull bookings" title="Pull the last 7 days of bookings from this channel" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
                      <Download className="h-4 w-4" />
                    </button>
                  </form>
                  {ch.status === "paused"
                    ? <ResumeChannelButton channelId={ch.id} channelName={ch.name} />
                    : <PauseChannelButton channelId={ch.id} channelName={ch.name} />}
                  <ChannelSettingsDialog channel={ch} />
                  <span className="mx-0.5 h-5 w-px bg-surface-border" aria-hidden />
                  <DisconnectChannelButton channelId={ch.id} channelName={ch.name} />
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

              {/* Connectivity health — rolling success rate of the last 24h, distinct from the
                  "last push" timestamp above (spec §3.5). <100% is flagged. */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-ink-500">
                  <span>Connectivity health · last 24h</span>
                  <span className="tnum text-ink-700">
                    {m?.health24h == null ? "no pushes yet" : `${m.health24h < 100 ? "⚠ " : ""}${m.health24h}% delivered · ${m.syncs24h} updates`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                  {m?.health24h != null && (
                    <div
                      className={`h-full rounded-full ${m.health24h >= 98 ? "bg-success-500" : m.health24h >= 80 ? "bg-warning-500" : "bg-danger-500"}`}
                      style={{ width: `${m.health24h}%` }}
                    />
                  )}
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

      {dormant.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Disconnected channels" subtitle="Mapping preserved dormant — reconnecting never forces a re-map; imported reservations stay valid" />
          <ul className="divide-y divide-surface-border">
            {dormant.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <ChannelLogo code={ch.code} name={ch.name} />
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold text-ink-900">{ch.name}</div>
                  <div className="text-[11.5px] text-ink-400">last push {relativeTime(ch.lastSyncAt)} · mapping dormant</div>
                </div>
                <ReconnectChannelButton channelId={ch.id} channelName={ch.name} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
