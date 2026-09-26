import {
  Radio, Boxes, Unlink, ArrowUpDown, AlertCircle, CheckCircle2, CircleSlash,
  Coins, CalendarPlus, Upload, Wrench, RotateCw, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { syncRecencyHealth, failureVerdict } from "@revio/core";
import { hasFinishedSetup } from "@revio/core";
import { SetupChecklist } from "@revio/ui/setup-checklist";
import { StatCard, type StatTone } from "@revio/ui/stat-card";
import { getDashboard, getReservationSummary } from "@/lib/data";
import { getSetup } from "@/lib/setup";
import { prisma } from "@/lib/db";
import { PauseChannelButton, ResumeChannelButton, DisconnectChannelButton, FullSyncButton } from "@/components/channels/ChannelActions";
import { ReservationSummaryCard } from "@/components/dashboard/ReservationSummaryCard";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { dashboard as dashDict, type CmDashboardStrings } from "@/lib/i18n/dashboard";
import { relativeTimeIn } from "@/lib/i18n/relative";

export const dynamic = "force-dynamic";

const CHANNEL_INITIALS: Record<string, string> = { booking: "B", expedia: "E", trip: "T", agoda: "A" };

/** core `describeAge`, in the reader's words — same thresholds. */
function ageIn(t: CmDashboardStrings, ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return t.age.justNow;
  if (min < 60) return t.age.min(min);
  const h = Math.floor(min / 60);
  if (h < 24) return t.age.hours(h);
  const d = Math.floor(h / 24);
  return d === 1 ? t.age.oneDay : t.age.days(d);
}

export default async function DashboardPage() {
  const { property, stats, channels, successByChannel, realErrorsByChannel, reservations, syncEvents, errorItems } = await getDashboard();

  /**
   * A hotel that has never configured anything goes into the guided flow instead of a dashboard of
   * zeros. Two conditions: this product's setup is unfinished, AND the hotel has not started it.
   *
   * Redirecting on `setupCompleted` alone would trap an established hotel that simply never clicked
   * the last screen — including both demo tenants — in a flow they do not need. So a second test is
   * needed for "has not started".
   *
   * ⚠️ **That test must be RevioLink's OWN object, and it used to be a shared one.** It counted room
   * types — which belong to RevioCRS and are shared from it. A hotel that set RevioCRS up first and
   * then opened RevioLink therefore had room types, failed this test, and landed on a dashboard with
   * no channel connected instead of the short setup flow that exists precisely for them: *"most of
   * this is already done… your team's logins are shared with RevioCRS"*. That flow was built and
   * tested and was unreachable by the path it was written for.
   *
   * Channels are what RevioLink itself owns. A hotel with none has not started RevioLink, whatever
   * RevioCRS has already given it — and one WITH channels is established here, so the safety net for
   * legacy accounts still holds.
   */
  const channelCount = await prisma.channel.count({ where: { propertyId: property.id } });
  if (!hasFinishedSetup(property.setupCompleted, "RevioLink") && channelCount === 0) {
    redirect("/welcome/property");
  }
  const [resSummary, setup] = await Promise.all([getReservationSummary(), getSetup()]);
  const { t: tr, locale, money } = await i18n();
  const t = tr(dashDict);
  const relativeTime = relativeTimeIn(locale);

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
  // core decides the verdicts; the words are the reader's, by health — see lib/i18n/dashboard.ts.
  const recencyWords = { ...t.recency[recency.health as keyof typeof t.recency] };
  const failureWords = failures.health === "unknown"
    ? t.failure.unknown
    : failures.health === "dead"
      ? { label: t.failure.dead.label, detail: t.failure.dead.detail(stats.failedSyncs, stats.syncAttempts24h) }
      : { label: t.failure.healthy.label, detail: t.failure.healthy.detail(stats.syncAttempts24h) };
  const pendingSub = stats.pendingUpdates <= 0
    ? t.pendingSub.empty
    : stats.oldestPendingAt == null
      ? t.pendingSub.waiting(stats.pendingUpdates)
      : t.pendingSub.waitingOldest(stats.pendingUpdates, ageIn(t, now.getTime() - stats.oldestPendingAt.getTime()));

  /** A health verdict → the pill tone this shell uses. `unknown`/`idle` must never read as success. */
  const HEALTH_TONE = {
    healthy: "success", stale: "warning", dead: "danger", idle: "neutral", unknown: "warning",
  } as const;

  // Every KPI clicks through to its filtered destination (spec §3.1).
  const cards = [
    {
      icon: Radio, tone: hasChannels ? "success" : "neutral", href: "/channels",
      value: `${stats.connectedChannels} / ${stats.totalChannels}`, label: t.cards.connected,
      sub: !hasChannels ? t.cards.connectedNone : allConnected ? t.cards.connectedAll : t.cards.connectedMissing(stats.totalChannels - stats.connectedChannels),
      pill: !hasChannels ? { tone: "neutral" as const, text: t.pills.none } : allConnected ? { tone: "success" as const, text: t.pills.healthy } : { tone: "warning" as const, text: t.pills.partial },
    },
    {
      icon: Boxes, tone: stats.activeProducts > 0 ? "info" : "neutral", href: "/rooms-rates",
      value: String(stats.activeProducts), label: t.cards.active,
      sub: stats.activeProducts > 0 ? t.cards.activeSub : t.cards.activeNone,
      pill: stats.activeProducts > 0 ? { tone: "info" as const, text: t.pills.sellable } : { tone: "neutral" as const, text: t.pills.none },
    },
    {
      icon: Unlink, tone: stats.unmappedProducts > 0 ? "warning" : "success", href: "/mapping",
      value: String(stats.unmappedProducts), label: t.cards.unmapped,
      sub: stats.unmappedProducts > 0 ? t.cards.unmappedSub : hasChannels ? t.cards.unmappedClear : t.cards.unmappedNothing,
      pill: stats.unmappedProducts > 0 ? { tone: "warning" as const, text: t.pills.action } : { tone: "neutral" as const, text: t.pills.clear },
    },
    {
      icon: ArrowUpDown, tone: pendingStuck ? "danger" : stats.pendingUpdates > 0 ? "info" : "neutral", href: "/sync?tab=activity",
      value: String(stats.pendingUpdates), label: t.cards.pending, sub: pendingSub,
      pill: pendingStuck
        ? { tone: "danger" as const, text: t.pills.stuck }
        : stats.pendingUpdates > 0 ? { tone: "info" as const, text: t.pills.queued } : { tone: "neutral" as const, text: t.pills.clear },
    },
    {
      icon: AlertCircle, tone: HEALTH_TONE[failures.health], href: "/sync?tab=errors",
      // "—" rather than "0" when nothing ran: a zero implies something was measured.
      value: failures.health === "unknown" ? "—" : String(stats.failedSyncs), label: t.cards.failed,
      sub: failureWords.detail ?? t.cards.failedSub,
      pill: { tone: HEALTH_TONE[failures.health], text: failureWords.label },
    },
    {
      icon: CheckCircle2, tone: HEALTH_TONE[recency.health], href: "/sync",
      value: everSynced ? relativeTime(stats.lastSync) : "—", label: t.cards.lastSync,
      // This is THE card that must never be green while stale. It is the one number answering
      // "is this thing working", and it used to reassure while saying it had not worked in a month.
      sub: recencyWords.detail || t.cards.lastSyncSub,
      pill: { tone: HEALTH_TONE[recency.health], text: recencyWords.label },
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
        title={t.title}
        subtitle={t.subtitle(property.name)}
        action={
          allConnected ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-success-50 px-3 py-1.5 text-[12.5px] font-semibold text-success-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success-500" /> {t.syncingLive}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-1.5 text-[12.5px] font-semibold text-ink-500">
              <span className="h-2 w-2 rounded-full bg-ink-300" />
              {hasChannels ? t.someNotConnected : t.noneConnected}
            </span>
          )
        }
      />

      {/* First run: the shortest honest path to being on sale. Disappears for good once complete. */}
      {setup.show && (
        <SetupChecklist
          productName="RevioLink"
          promise={t.setupPromise}
          steps={setup.steps.map((st) => ({ ...st, ...(t.setupSteps[st.key] ?? {}) }))}
          locale={locale}
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
          <CardHeader title={t.channelStatus} action={<a href="/channels" className="text-[12px] font-semibold text-brand-600 hover:underline">{t.viewAll}</a>} />
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2 font-semibold">{t.cols.channel}</th>
                <th className="px-4 py-2 font-semibold">{t.cols.status}</th>
                <th className="px-4 py-2 font-semibold">{t.cols.lastSync}</th>
                <th className="px-4 py-2 text-right font-semibold">{t.cols.pending}</th>
                <th className="px-4 py-2 text-right font-semibold">{t.cols.errors}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-ink-400">
                    {t.noChannelsLead}<Link href="/channels" className="font-semibold text-brand-600 hover:underline">{t.noChannelsLink}</Link>{t.noChannelsTail}
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
                        {ch.status === "connected" ? t.connected : ch.status === "paused" ? t.paused : ch.status}
                      </StatusPill>
                      {ch.status === "connected" && (() => {
                        /*
                         * The channel's last SUCCESS, not `ch.lastSyncAt`.
                         *
                         * `Channel.lastSyncAt` is stamped before the result is read, so it is an
                         * attempt. Feeding it to a function whose parameter is named `lastSuccessAt`
                         * painted a channel failing every five minutes as Live — the same mistake
                         * the three cards above this table were fixed for, still live down here.
                         * Absent from the map means it has never succeeded, which is `null`, which
                         * reads as "Never synced" rather than as health.
                         */
                        const h = syncRecencyHealth(successByChannel.get(ch.id) ?? null, now);
                        return h.health === "healthy" ? null : (
                          <span title={t.recency[h.health as keyof typeof t.recency]?.detail || undefined}>
                            <StatusPill tone={HEALTH_TONE[h.health]}>{t.recency[h.health as keyof typeof t.recency]?.label ?? h.label}</StatusPill>
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  {/* Success, to match the column header. An attempt belongs in the Sync Center. */}
                  <td className="px-4 py-2.5 text-ink-500">
                    {successByChannel.has(ch.id) ? relativeTime(successByChannel.get(ch.id)!) : t.never}
                  </td>
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
          <CardHeader title={t.quickActions} />
          <div className="grid grid-cols-1 gap-1.5 p-3">
            {[
              { icon: CalendarPlus, label: t.actions.calendar, href: "/calendar" },
              { icon: Upload, label: t.actions.bulk, href: "/bulk-update" },
              { icon: Radio, label: t.actions.connect, href: "/channels" },
              { icon: Wrench, label: t.actions.fixMapping, href: "/mapping" },
              { icon: RotateCw, label: t.actions.retry, href: "/sync" },
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
          <CardHeader title={t.recentActivity} action={<a href="/sync" className="text-[12px] font-semibold text-brand-600 hover:underline">{t.syncCenter}</a>} />
          <ul className="divide-y divide-surface-border/60">
            {syncEvents.length === 0 && (
              <li className="px-4 py-8 text-center text-[12.5px] text-ink-400">
                {t.noActivity}
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
            <CardHeader title={t.latest} action={<a href="/reservations" className="text-[12px] font-semibold text-brand-600 hover:underline">{t.all}</a>} />
            <ul className="divide-y divide-surface-border/60">
              {reservations.length === 0 && (
                <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">
                  {t.noBookings}
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
              <div className="text-[12px] font-semibold text-ink-700">{t.stopSold}</div>
              <div className="text-[11px] text-ink-400">{t.stopSoldSub}</div>
            </Card>
            <Card className="p-4">
              <Coins className="mb-2 h-5 w-5 text-warning-500" />
              <div className="tnum text-[22px] font-bold text-ink-900">{stats.currencyWarnings}</div>
              <div className="text-[12px] font-semibold text-ink-700">{t.currency}</div>
              <div className="text-[11px] text-ink-400">{t.currencySub}</div>
            </Card>
          </div>

          {errorItems.length > 0 && (
            <Card className="border-danger-500/30 bg-danger-50/40">
              <CardHeader title={t.needsAttention} action={<a href="/sync?tab=errors" className="text-[12px] font-semibold text-danger-600 hover:underline">{t.errorCenter}</a>} />
              <ul className="divide-y divide-danger-500/10">
                {errorItems.slice(0, 3).map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={e.severity === "critical" ? "danger" : "warning"}>{t.severity[e.severity] ?? e.severity}</StatusPill>
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
