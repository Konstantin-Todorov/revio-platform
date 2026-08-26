import { Download, Radio } from "lucide-react";
import { getChannels, getProperty } from "@/lib/data";
import { pullChannelBookings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ChannelSettingsDialog, AddChannelDialog } from "@/components/channels/ChannelDialogs";
import { ConnectChannelDialog } from "@/components/channels/ConnectChannelDialog";
import { ProvisionChannex } from "@/components/channels/ProvisionChannex";
import { CHANNEL_CODES } from "@revio/connectivity";
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
  // A demo hotel is the one case where a fabricated channel is correct — the mock adapter is what
  // makes the whole ARI loop demonstrable without an OTA.
  const property = await getProperty();
  const isDemo = property.tenant.isDemo;
  const propertyName = property.name;
  const statById = Object.fromEntries(mapStats.map((m) => [m.channelId, m]));
  const active = channels.filter((c) => c.status !== "disconnected");
  const dormant = channels.filter((c) => c.status === "disconnected");

  /*
   * Which "add a channel" affordance this hotel gets. THREE states, not two.
   *
   * The two-state version shipped earlier was a real hazard: a hotel with no Channex property fell
   * through to the MOCK dialog, which fabricates external ids. A demo hotel wants exactly that. A
   * real hotel that has just finished onboarding gets a channel marked connected that pushes
   * nowhere — and no way to tell.
   *
   *   on Channex   → the real dialog: ask Channex what the channel needs, test, create
   *   demo tenant  → the mock dialog, which is what it is for
   *   neither      → provision first. Not a dialog, because there is nothing to fill in.
   *
   * The test is a Channex property id rather than an entitlement: that is what the real flow
   * requires, and a hotel mid-onboarding has the entitlement before it has the property.
   */
  const onChannex = channels.some((c) => c.externalPropertyId && c.connectivityMode !== "mock");
  const connectedCodes = channels.map((c) => c.code);
  const addButton = onChannex ? (
    <ConnectChannelDialog channels={CHANNEL_CODES} connectedCodes={connectedCodes} />
  ) : isDemo ? (
    <AddChannelDialog connectedCodes={connectedCodes} />
  ) : null;

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle="Connected OTAs, mapping health and per-channel settings"
        action={addButton}
      />

      {/*
        A real hotel that is not on Channex yet is asked to provision, NOT offered a channel dialog.
        There is nothing for them to fill in at this point, and offering a form implies otherwise.
      */}
      {!onChannex && !isDemo && <ProvisionChannex propertyName={propertyName} />}

      {channels.length === 0 && (onChannex || isDemo) && (
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Radio className="h-5 w-5" />
          </div>
          <h2 className="text-[15px] font-bold text-ink-900">No channels connected yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-500">
            Connecting a channel is what puts your rooms on sale. Add Booking.com, Expedia or any other OTA you
            work with, then map your room types to their listings.
          </p>
          <div className="mt-4 flex justify-center">
            {addButton}
          </div>
        </Card>
      )}

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
          <CardHeader title="Disconnected channels" subtitle="Reconnecting keeps the mapping you already did, and bookings already imported stay valid" />
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
