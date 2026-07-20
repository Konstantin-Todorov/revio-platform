import {
  Radio, Boxes, Unlink, ArrowUpDown, AlertCircle, CheckCircle2, CircleSlash,
  Coins, CalendarPlus, Upload, Wrench, RotateCw, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { getDashboard, getReservationSummary } from "@/lib/data";
import { PauseChannelButton, ResumeChannelButton, DisconnectChannelButton, FullSyncButton } from "@/components/channels/ChannelActions";
import { ReservationSummaryCard } from "@/components/dashboard/ReservationSummaryCard";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNEL_INITIALS: Record<string, string> = { booking: "B", expedia: "E", trip: "T", agoda: "A" };

export default async function DashboardPage() {
  const { property, stats, channels, realErrorsByChannel, reservations, syncEvents, errorItems } = await getDashboard();
  const resSummary = await getReservationSummary();

  // Pending age (spec §5.3): ten items two seconds old is healthy; two hours old means stuck.
  const pendingAgeMs = stats.oldestPendingAt ? Date.now() - stats.oldestPendingAt.getTime() : null;
  const pendingStuck = pendingAgeMs != null && pendingAgeMs > 30 * 60 * 1000;
  const pendingSub = pendingAgeMs == null ? "Queue empty — all delivered" : `Oldest waiting ${relativeTime(stats.oldestPendingAt)}`;

  // Every KPI clicks through to its filtered destination (spec §3.1).
  const cards = [
    { icon: Radio, tone: "success", href: "/channels", value: `${stats.connectedChannels} / ${stats.totalChannels}`, label: "Connected Channels", sub: "All channels connected", pill: { tone: "success" as const, text: "Healthy" } },
    { icon: Boxes, tone: "info", href: "/rooms-rates", value: String(stats.activeProducts), label: "Active Products", sub: "Room types × rate plans", pill: { tone: "info" as const, text: "Sellable" } },
    { icon: Unlink, tone: "warning", href: "/mapping", value: String(stats.unmappedProducts), label: "Unmapped Products", sub: "Require mapping", pill: { tone: "warning" as const, text: "Action" } },
    { icon: ArrowUpDown, tone: pendingStuck ? "danger" : "info", href: "/sync?tab=activity", value: String(stats.pendingUpdates), label: "Pending Updates", sub: pendingSub, pill: pendingStuck ? { tone: "danger" as const, text: "Stuck?" } : { tone: "info" as const, text: "Queued" } },
    { icon: AlertCircle, tone: "danger", href: "/sync?tab=errors", value: String(stats.failedSyncs), label: "Failed Syncs", sub: "Real failures · 24h (limitations excluded)", pill: { tone: "danger" as const, text: "Review" } },
    { icon: CheckCircle2, tone: "success", href: "/sync", value: relativeTime(stats.lastSync), label: "Last Successful Sync", sub: "Across all channels", pill: { tone: "success" as const, text: "Live" } },
  ];

  const TONE_BG: Record<string, string> = {
    success: "bg-success-50 text-success-600", info: "bg-accent-50 text-accent-600",
    warning: "bg-warning-50 text-warning-600", danger: "bg-danger-50 text-danger-600",
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${property.name} · distribution health`}
        action={
          <span className="inline-flex items-center gap-2 rounded-md bg-success-50 px-3 py-1.5 text-[12.5px] font-semibold text-success-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success-500" /> Syncing live
          </span>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="block">
            <Card className="h-full p-4 transition-shadow hover:shadow-md">
              <div style={{ animationDelay: `${i * 45}ms` }} className="animate-rise">
                <div className="mb-3 flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${TONE_BG[c.tone]}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <StatusPill tone={c.pill.tone}>{c.pill.text}</StatusPill>
                </div>
                <div className="tnum text-[26px] font-bold leading-none tracking-tight text-ink-900">{c.value}</div>
                <div className="mt-1.5 text-[12.5px] font-semibold text-ink-700">{c.label}</div>
                <div className="text-[11.5px] text-ink-400">{c.sub}</div>
              </div>
            </Card>
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
                    <StatusPill tone={ch.status === "connected" ? "success" : ch.status === "paused" ? "warning" : "neutral"}>
                      {ch.status === "connected" ? "Connected" : ch.status === "paused" ? "Paused" : ch.status}
                    </StatusPill>
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
