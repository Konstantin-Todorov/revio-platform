import {
  Radio, Boxes, Unlink, ArrowUpDown, AlertCircle, CheckCircle2, CircleSlash,
  Coins, CalendarPlus, Upload, Wrench, RotateCw, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { syncRecencyHealth, failureVerdict, pendingSubtitle } from "@revio/core";
import { hasFinishedSetup } from "@revio/core";
import { SetupChecklist } from "@revio/ui/setup-checklist";
import { StatCard, type StatTone } from "@revio/ui/stat-card";
import { getDashboard, getReservationSummary } from "@/lib/data";
import { getSetup } from "@/lib/setup";
import { prisma } from "@/lib/db";
import { PauseChannelButton, ResumeChannelButton, DisconnectChannelButton, FullSyncButton } from "@/components/channels/ChannelActions";
import { ReservationSummaryCard } from "@/components/dashboard/ReservationSummaryCard";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNEL_INITIALS: Record<string, string> = { booking: "B", expedia: "E", trip: "T", agoda: "A" };

export default async function DashboardPage() {
  const { property, stats, channels, realErrorsByChannel, reservations, syncEvents, errorItems } = await getDashboard();

  /**
   * A hotel that has never configured anything goes into the guided flow instead of a dashboard of
   * zeros. Two conditions, and the second matters more than the first: they must not have finished
   * setup AND have no room types at all. Redirecting on `setupCompleted` alone would trap an
   * established hotel that simply never clicked the last screen — including both demo tenants — in a
   * welcome flow they do not need. "Has no rooms" is the honest test for "has not started".
   */
  const roomTypeCount = await prisma.roomType.count({ where: { propertyId: property.id } });
  if (!hasFinishedSetup(property.setupCompleted, "RevioLink") && roomTypeCount === 0) {
    redirect("/welcome/property");
  }
  const [resSummary, setup] = await Promise.all([getReservationSummary(), getSetup()]);

  // Pending age (spec §5.3): ten items two seconds old is healthy; two hours old means stuck.
  const pendingAgeMs = stats.oldestPendingAt ? Date.now() - stats.oldestPendingAt.getTime() : null;
  const pendingStuck = pendingAgeMs != null && pendingAgeMs > 30 * 60 * 1000;

  // A dashboard that reports "Healthy · all channels connected · queue empty — all delivered" to a
  // hotel with zero channels is lying to it on day one. Every pill below is derived from what has
  // actually happened, so an empty property reads as "not set up yet", never as green.
  const hasChannels = stats.totalChannels > 0;
  const allConnected = hasChannels && stats.connectedChannels === stats.totalChannels;
  const everSynced = stats.lastSync != null;

  /*
   * Health from what HAPPENED, not from what is configured — `@revio/core/sync-health`.
   *
   * Three cards below used to report green over a dead channel: "Last Successful Sync: 29d ago"
   * badged Live, "Queue empty — all delivered" printed above a queue of 10, and "0 Failed Syncs ·
   * Clear" on a property where nothing was attempted. All three asked the wrong question, and the
   * answers are now derived by one tested module the Operator console shares.
   */
  const now = new Date();
  const recency = syncRecencyHealth(stats.lastSync, now);
  const failures = failureVerdict(stats.syncAttempts24h, stats.failedSyncs);
  const pendingSub = pendingSubtitle(stats.pendingUpdates, stats.oldestPendingAt, now);

  /** A health verdict → the pill tone this shell uses. `unknown`/`idle` must never read as success. */
  const HEALTH_TONE = {
    healthy: "success", stale: "warning", dead: "danger", idle: "neutral", unknown: "warning",
  } as const;

  // Every KPI clicks through to its filtered destination (spec §3.1).
  const cards = [
    {
      icon: Radio, tone: hasChannels ? "success" : "neutral", href: "/channels",
      value: `${stats.connectedChannels} / ${stats.totalChannels}`, label: "Connected Channels",
      sub: !hasChannels ? "No channels connected yet" : allConnected ? "All channels connected" : `${stats.totalChannels - stats.connectedChannels} not connected`,
      pill: !hasChannels ? { tone: "neutral" as const, text: "None" } : allConnected ? { tone: "success" as const, text: "Healthy" } : { tone: "warning" as const, text: "Partial" },
    },
    {
      icon: Boxes, tone: stats.activeProducts > 0 ? "info" : "neutral", href: "/rooms-rates",
      value: String(stats.activeProducts), label: "Active Products",
      sub: stats.activeProducts > 0 ? "Room types × rate plans" : "Add a room type to start",
      pill: stats.activeProducts > 0 ? { tone: "info" as const, text: "Sellable" } : { tone: "neutral" as const, text: "None" },
    },
    {
      icon: Unlink, tone: stats.unmappedProducts > 0 ? "warning" : "success", href: "/mapping",
      value: String(stats.unmappedProducts), label: "Unmapped Products",
      sub: stats.unmappedProducts > 0 ? "Require mapping" : hasChannels ? "Everything is mapped" : "Nothing to map yet",
      pill: stats.unmappedProducts > 0 ? { tone: "warning" as const, text: "Action" } : { tone: "neutral" as const, text: "Clear" },
    },
    {
      icon: ArrowUpDown, tone: pendingStuck ? "danger" : stats.pendingUpdates > 0 ? "info" : "neutral", href: "/sync?tab=activity",
      value: String(stats.pendingUpdates), label: "Pending Updates", sub: pendingSub,
      pill: pendingStuck
        ? { tone: "danger" as const, text: "Stuck?" }
        : stats.pendingUpdates > 0 ? { tone: "info" as const, text: "Queued" } : { tone: "neutral" as const, text: "Clear" },
    },
    {
      icon: AlertCircle, tone: HEALTH_TONE[failures.health], href: "/sync?tab=errors",
      // "—" rather than "0" when nothing ran: a zero implies something was measured.
      value: failures.health === "unknown" ? "—" : String(stats.failedSyncs), label: "Failed Syncs",
      sub: failures.detail ?? "Real failures · 24h (limitations excluded)",
      pill: { tone: HEALTH_TONE[failures.health], text: failures.label },
    },
    {
      icon: CheckCircle2, tone: HEALTH_TONE[recency.health], href: "/sync",
      value: everSynced ? relativeTime(stats.lastSync) : "—", label: "Last Successful Sync",
      // This is THE card that must never be green while stale. It is the one number answering
      // "is this thing working", and it used to reassure while saying it had not worked in a month.
      sub: recency.detail ?? "Across all channels",
      pill: { tone: HEALTH_TONE[recency.health], text: recency.label },
    },
  ];

  /*
   * The card's own tone vocabulary maps onto StatCard's. Only `info` differs by name — it was the
   * accent tint here and stays the accent tint there, so nothing changes on screen.
   */
  const STAT_TONE: Record<string, StatTone> = {
    success: "success", info: "accent", warning: "warning", danger: "danger", neutral: "neutral",
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${property.name} · distribution health`}
        action={
          allConnected ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-success-50 px-3 py-1.5 text-[12.5px] font-semibold text-success-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success-500" /> Syncing live
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-1.5 text-[12.5px] font-semibold text-ink-500">
              <span className="h-2 w-2 rounded-full bg-ink-300" />
              {hasChannels ? "Some channels are not connected" : "No channels connected"}
            </span>
          )
        }
      />

      {/* First run: the shortest honest path to being on sale. Disappears for good once complete. */}
      {setup.show && (
        <SetupChecklist
          productName="RevioLink"
          promise="Four steps and your rooms are on sale across every channel you connect."
          steps={setup.steps}
          done={setup.done}
          total={setup.total}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="block">
            {/*
              The health pill goes in StatCard's `badge` slot rather than its `delta` slot. They
              render in the same corner and it would have compiled either way — but a delta says
              which way a number moved and a pill says whether a system is working, and rendering
              one as the other is exactly how a screen ends up claiming health nobody measured.
            */}
            <div style={{ animationDelay: `${i * 45}ms` }} className="animate-rise h-full">
              <StatCard
                tone={STAT_TONE[c.tone]}
                label={c.label}
                value={c.value}
                sub={c.sub}
                icon={<Icon className="h-4 w-4" />}
                badge={<StatusPill tone={c.pill.tone}>{c.pill.text}</StatusPill>}
              />
            </div>
            </Link>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Channel status */}
        <Card className="lg:col-span-2">
          <CardHeader title="Channel Status" action={<a href="/channels" className="text-[12px] font-semibold text-brand-600 hover:underline">View all</a>} />
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2 font-semibold">Channel</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Last Sync</th>
                <th className="px-4 py-2 text-right font-semibold">Pending</th>
                <th className="px-4 py-2 text-right font-semibold">Errors</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-ink-400">
                    No channels yet. <Link href="/channels" className="font-semibold text-brand-600 hover:underline">Connect your first channel</Link> to put your rooms on sale.
                  </td>
                </tr>
              )}
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-[12px] font-bold text-brand-700">
                        {CHANNEL_INITIALS[ch.code] ?? ch.name[0]}
                      </span>
                      <span className="font-semibold text-ink-900">{ch.name}</span>
                      <span className="text-[11px] text-ink-400">{ch.currency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {/*
                      * TWO pills, because they answer two different questions and only the second
                      * one matters. "Connected" is the socket; the health pill is whether anything
                      * has actually arrived. A channel that last synced 65 days ago used to show a
                      * single green Connected and nothing else — the user reads that as delivery.
                      */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill tone={ch.status === "connected" ? "success" : ch.status === "paused" ? "warning" : "neutral"}>
                        {ch.status === "connected" ? "Connected" : ch.status === "paused" ? "Paused" : ch.status}
                      </StatusPill>
                      {ch.status === "connected" && (() => {
                        const h = syncRecencyHealth(ch.lastSyncAt, now);
                        return h.health === "healthy" ? null : (
                          <span title={h.detail ?? undefined}>
                            <StatusPill tone={HEALTH_TONE[h.health]}>{h.label}</StatusPill>
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">{relativeTime(ch.lastSyncAt)}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-700">{ch.pendingCount}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {/* Real errors only — capability limitations never show red (spec §5.2). */}
                    {(realErrorsByChannel.get(ch.id) ?? 0) > 0
                      ? <span className="font-bold text-danger-500">{realErrorsByChannel.get(ch.id)}</span>
                      : <span className="text-ink-300">0</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    {/* Per-row quick actions (CM-UPDATES-V1): sync · pause/resume · disconnect. */}
                    <div className="flex items-center justify-end gap-0.5">
                      {ch.status !== "paused" && ch.status !== "disconnected" && <FullSyncButton channelId={ch.id} channelName={ch.name} />}
                      {ch.status === "paused"
                        ? <ResumeChannelButton channelId={ch.id} channelName={ch.name} />
                        : ch.status !== "disconnected" && <PauseChannelButton channelId={ch.id} channelName={ch.name} />}
                      {ch.status !== "disconnected" && <DisconnectChannelButton channelId={ch.id} channelName={ch.name} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-1 gap-1.5 p-3">
            {[
              { icon: CalendarPlus, label: "Open Calendar", href: "/calendar" },
              { icon: Upload, label: "Bulk Rates", href: "/bulk-update" },
              { icon: Radio, label: "Connect Channel", href: "/channels" },
              { icon: Wrench, label: "Fix Mapping", href: "/mapping" },
              { icon: RotateCw, label: "Retry Failed Syncs", href: "/sync" },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <a key={a.label} href={a.href} className="group flex items-center gap-3 rounded-md border border-surface-border bg-white px-3 py-2.5 text-[13px] font-semibold text-ink-700 transition-colors hover:border-brand-600 hover:bg-brand-50">
                  <Icon className="h-4 w-4 text-brand-600" />
                  {a.label}
                  <ArrowRight className="ml-auto h-4 w-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </a>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Lower grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Activity" action={<a href="/sync" className="text-[12px] font-semibold text-brand-600 hover:underline">Sync Center</a>} />
          <ul className="divide-y divide-surface-border/60">
            {syncEvents.length === 0 && (
              <li className="px-4 py-8 text-center text-[12.5px] text-ink-400">
                Nothing has been pushed or pulled yet. Activity appears here the moment a channel is connected.
              </li>
            )}
            {syncEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${e.status === "failed" ? "bg-danger-500" : e.status === "pending" ? "bg-warning-500" : "bg-success-500"}`} />
                <span className="flex-1 text-ink-700">{e.summary}</span>
                {e.channel && <span className="text-[11px] font-medium text-ink-400">{e.channel.name}</span>}
                <span className="tnum text-[11.5px] text-ink-400">{relativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Right column: reservations + warnings */}
        <div className="space-y-4">
          <ReservationSummaryCard newRes={resSummary.newRes} cancelled={resSummary.cancelled} />

          <Card>
            <CardHeader title="Latest Reservations" action={<a href="/reservations" className="text-[12px] font-semibold text-brand-600 hover:underline">All</a>} />
            <ul className="divide-y divide-surface-border/60">
              {reservations.length === 0 && (
                <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">
                  No bookings imported yet.
                </li>
              )}
              {reservations.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-[11px] font-bold text-brand-700">
                    {r.channel ? (CHANNEL_INITIALS[r.channel.code] ?? r.channel.name[0]) : "D"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-ink-900">{r.guestName}</div>
                    <div className="tnum text-[11px] text-ink-400">#{r.externalId ?? r.id.slice(-6)}</div>
                  </div>
                  <div className="text-right">
                    <div className="tnum text-[12.5px] font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</div>
                    <div className="text-[11px] text-ink-400">{relativeTime(r.importedAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <CircleSlash className="mb-2 h-5 w-5 text-warning-500" />
              <div className="tnum text-[22px] font-bold text-ink-900">{stats.stopSold}</div>
              <div className="text-[12px] font-semibold text-ink-700">Stop-Sold</div>
              <div className="text-[11px] text-ink-400">Products held back</div>
            </Card>
            <Card className="p-4">
              <Coins className="mb-2 h-5 w-5 text-warning-500" />
              <div className="tnum text-[22px] font-bold text-ink-900">{stats.currencyWarnings}</div>
              <div className="text-[12px] font-semibold text-ink-700">Currency</div>
              <div className="text-[11px] text-ink-400">Channels in FX</div>
            </Card>
          </div>

          {errorItems.length > 0 && (
            <Card className="border-danger-500/30 bg-danger-50/40">
              <CardHeader title="Needs Attention" action={<a href="/errors" className="text-[12px] font-semibold text-danger-600 hover:underline">Error Center</a>} />
              <ul className="divide-y divide-danger-500/10">
                {errorItems.slice(0, 3).map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{e.severity}</StatusPill>
                      <span className="text-[12.5px] font-semibold text-ink-900">{e.message}</span>
                    </div>
                    {e.recommendedAction && <div className="mt-1 pl-1 text-[11.5px] text-ink-500">{e.recommendedAction}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
