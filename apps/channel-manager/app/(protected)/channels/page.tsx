import { CheckCircle2, Circle, Download, Radio, RotateCcw } from "lucide-react";
import Link from "next/link";
import { channelJourney, type JourneyStep } from "@revio/core";
import { getChannels, getProperty } from "@/lib/data";
import { pullChannelBookings, reimportChannelBookings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ChannelSettingsDialog, AddChannelDialog } from "@/components/channels/ChannelDialogs";
import { ConnectChannelDialog } from "@/components/channels/ConnectChannelDialog";
import { ProvisionChannex } from "@/components/channels/ProvisionChannex";
import { CHANNEL_CODES } from "@revio/connectivity";
import {
  PauseChannelButton, ResumeChannelButton, DisconnectChannelButton, ReconnectChannelButton, FullSyncButton,
} from "@/components/channels/ChannelActions";
import { i18n } from "@/lib/i18n/server";
import { channels as channelsDict, type CmChannelsStrings } from "@/lib/i18n/channels";
import { relativeTimeIn } from "@/lib/i18n/relative";

export const dynamic = "force-dynamic";

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

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  connected: "success",
  paused: "warning",
  error: "danger",
  disconnected: "neutral",
  /*
   * ⚠️ This row was missing, so the pill fell through to `?? ch.status` and printed the raw database
   * word **"pending"** at a hotelier — with no explanation and nothing to press.
   *
   * It is worse than an unlabelled state, because "pending" already means something else here: the
   * spec (CM-GUIDE-V2 §glossary) uses it for the OUTBOX QUEUE DEPTH — updates waiting to go out —
   * and this card shows exactly that number two lines below, under "Pending". Same word, two
   * meanings, on one card.
   *
   * What this status actually means: the connection has been created inside Channex and nobody has
   * switched it on yet, so the OTA is not talking to us at all.
   */
  pending: "warning",
};

/**
 * What a channel that is not live yet means, and who has to do something about it.
 *
 * ⚠️ **The hotel cannot switch this on.** We are the Channex customer, not them — one organisation,
 * one key, every property (root CLAUDE.md). They have no Channex account and are never asked for
 * one. So a message telling them to go and activate it is a message about a door they cannot reach,
 * which is exactly what the connect dialog used to say.
 */
// The words are `notLiveYet` in lib/i18n/channels.ts.

/** Core's `channelJourney`, worded for the reader by step key — core decides which step is next. */
function sayJourney(s: CmChannelsStrings, steps: JourneyStep[], channel: string, rows: number, complete: number): JourneyStep[] {
  const j = s.journey;
  return steps.map((st) => ({
    ...st,
    label: j.labels[st.key](channel),
    ...(st.next !== undefined ? {
      next: st.key === "mapped" ? j.next.mapped(rows - complete, rows, channel)
        : st.key === "on_channex" ? j.next.on_channex
        : j.next[st.key](channel),
    } : {}),
    ...(st.action ? { action: { ...st.action, label: st.key === "verified" ? j.actions.verified : j.actions.mapped } } : {}),
  }));
}

export default async function ChannelsPage() {
  const [{ channels, mapStats }, { t, locale }] = await Promise.all([getChannels(), i18n()]);
  const s = t(channelsDict);
  const relativeTime = relativeTimeIn(locale);
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
        title={s.title}
        subtitle={s.subtitle}
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
          <h2 className="text-[15px] font-bold text-ink-900">{s.empty.title}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-500">
            {s.empty.body}
          </p>
          <div className="mt-4 flex justify-center">
            {addButton}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {active.map((ch) => {
          const m = statById[ch.id];
          const pct = m && m.total > 0 ? Math.min(100, Math.round((m.complete / m.total) * 100)) : 0;
          // The way to the first booking — real channels only; a demo channel has no OTA behind it.
          const journey = ch.connectivityMode === "mock" || !m ? null : sayJourney(s, channelJourney({
            channelName: ch.name, onChannex: Boolean(ch.externalPropertyId),
            mappingRows: m.total, mappingComplete: m.complete, status: ch.status,
            verifiedAt: m.verifiedAt, bookingsReceived: m.bookingsReceived,
            mappingHref: `/mapping?ch=${ch.code}`,
          }), ch.name, m.total, m.complete);
          const nextStep = journey?.find((st) => st.next);
          return (
            <Card key={ch.id} className="p-4">
              {/* Wraps on a phone: the actions drop under the name instead of squeezing it to one word a line. */}
              <div className="flex flex-wrap items-start gap-3">
                <ChannelLogo code={ch.code} name={ch.name} />
                <div className="min-w-0 flex-1 basis-44">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="text-[15px] font-bold text-ink-900">{ch.name}</h3>
                    <StatusPill tone={STATUS_TONE[ch.status] ?? "neutral"}>{s.status[ch.status as keyof typeof s.status] ?? ch.status}</StatusPill>
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-400">
                    {s.card.meta(ch.currency, ch.commissionPct, relativeTime(ch.lastSyncAt))}
                  </div>
                  <div className="mt-1">
                    <StatusPill tone={ch.connectivityMode === "mock" ? "neutral" : "info"}>{s.modes[ch.connectivityMode as keyof typeof s.modes] ?? ch.connectivityMode}</StatusPill>
                  </div>
                  {/*
                    Said on the card, not in a tooltip. A hotel that has just connected a channel and
                    sees a badge is entitled to know whether it is working, and this is the one state
                    where the honest answer is "not yet, and not by you".
                  */}
                  {ch.status === "pending" && (
                    <p className="mt-1.5 rounded-md border border-warning-600/30 bg-warning-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-warning-800">
                      {s.notLiveYet}
                    </p>
                  )}
                </div>
                {/* Quick actions (spec §3.5): Sync · Pull · Pause/Resume, with Disconnect separated
                    so it can't be hit by accident. All confirmed + audited per channel. */}
                <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                  {ch.errorCount > 0 && <StatusPill tone="danger">{s.card.errors(ch.errorCount)}</StatusPill>}
                  {/* Said out loud, not hidden in a tooltip: a booking the channel confirmed that is
                      not in the calendar is the most consequential thing this card can report. */}
                  {(m?.stuckBookings ?? 0) > 0 && (
                    <StatusPill tone="danger">
                      {s.card.stuck(m!.stuckBookings)}
                    </StatusPill>
                  )}
                  {ch.status !== "paused" && <FullSyncButton channelId={ch.id} channelName={ch.name} />}
                  <form action={pullChannelBookings}>
                    <input type="hidden" name="channelId" value={ch.id} />
                    <button type="submit" aria-label={s.card.pull} title={s.card.pullTitle} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600">
                      <Download className="h-4 w-4" />
                    </button>
                  </form>
                  {/*
                    Re-import — the answer to a specific situation, not a second Pull. A booking that
                    arrived before the mapping was finished was acknowledged to the channel, so the
                    revisions feed will never offer it again and the ordinary Pull cannot bring it
                    back. This is the only way to recover one.

                    ⚠️ It keys on STUCK BOOKINGS, not on `errorCount`. It used to key on the error
                    count, which a hotel decrements simply by pressing Resolve — so tidying the Error
                    Center made the one button that recovers the booking disappear, while the booking
                    stayed lost. That happened to a real client on 2026-09-15.

                    `errorCount` is still honoured: an error with no stuck booking is a different
                    fault, and offering the recovery there costs nothing.
                  */}
                  {(m?.stuckBookings ?? 0) + ch.errorCount > 0 && (
                    <form action={reimportChannelBookings}>
                      <input type="hidden" name="channelId" value={ch.id} />
                      <button
                        type="submit"
                        aria-label={m?.stuckBookings ? s.card.reimportStuck(m.stuckBookings) : s.card.reimport}
                        title={
                          m?.stuckBookings
                            ? s.card.reimportStuckTitle(m.stuckBookings)
                            : s.card.reimportTitle
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-md text-warning-600 transition-colors hover:bg-warning-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                  {ch.status === "paused"
                    ? <ResumeChannelButton channelId={ch.id} channelName={ch.name} />
                    : <PauseChannelButton channelId={ch.id} channelName={ch.name} />}
                  <ChannelSettingsDialog channel={ch} />
                  <span className="mx-0.5 h-5 w-px bg-surface-border" aria-hidden />
                  <DisconnectChannelButton channelId={ch.id} channelName={ch.name} />
                </div>
              </div>

              {/*
                Where this channel stands, as steps — the one place the card says what happens next.
                Collapsed to a single line once the first booking has arrived: then it is history.
              */}
              {journey && nextStep && (
                <div className="mt-3 rounded-md border border-surface-border bg-surface-muted/60 px-3 py-2.5">
                  <div className="mb-1.5 text-[11.5px] font-semibold text-ink-500">{s.card.wayTo(ch.name)}</div>
                  <ol className="space-y-1">
                    {journey.map((st) => (
                      <li key={st.key} className="flex items-start gap-2 text-[12.5px]">
                        {st.done
                          ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-success-600" aria-label={s.card.stepDone} />
                          : <Circle className={`mt-px h-4 w-4 shrink-0 ${st.next ? "text-brand-600" : "text-ink-300"}`} aria-label={st.next ? s.card.stepNext : s.card.stepLater} />}
                        <div className="min-w-0">
                          <span className={st.done ? "text-ink-500" : st.next ? "font-semibold text-ink-900" : "text-ink-400"}>{st.label}</span>
                          {st.next && <p className="mt-0.5 text-[12px] leading-snug text-ink-600">{st.next}</p>}
                          {st.action && (
                            <Link href={st.action.href} className="mt-1 inline-flex h-7 items-center rounded-md bg-brand-800 px-2.5 text-[12px] font-semibold text-white hover:bg-brand-700">
                              {st.action.label}
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-[11.5px] font-semibold text-ink-500">
                  <span>{s.card.mapping}</span>
                  <span className="tnum text-ink-700">{pct}% · {m?.complete}/{m?.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div className={`h-full rounded-full ${pct >= 98 ? "bg-success-500" : pct >= 90 ? "bg-warning-500" : "bg-danger-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Connectivity health — rolling success rate of the last 24h, distinct from the
                  "last push" timestamp above (spec §3.5). <100% is flagged. */}
              <div className="mt-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-[11.5px] font-semibold text-ink-500">
                  <span>{s.card.health}</span>
                  <span className="tnum text-ink-700">
                    {m?.health24h == null ? s.card.noPushes : `${m.health24h < 100 ? "⚠ " : ""}${s.card.delivered(m.health24h, m.syncs24h)}`}
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
                  <div className="text-[10.5px] font-medium text-ink-400">{s.card.pending}</div>
                </div>
                <div className="rounded-md bg-surface-muted py-2">
                  <div className="tnum text-[15px] font-bold text-ink-900">{ch.supportedRestrictions.length}</div>
                  <div className="text-[10.5px] font-medium text-ink-400">{s.card.restrictions}</div>
                </div>
                <div className="rounded-md bg-surface-muted py-2">
                  <div className="tnum text-[15px] font-bold text-ink-900">{ch.markupPct}%</div>
                  <div className="text-[10.5px] font-medium text-ink-400">{s.card.fxMarkup}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {dormant.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={s.dormant.title} subtitle={s.dormant.subtitle} />
          <ul className="divide-y divide-surface-border">
            {dormant.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 px-4 py-3">
                <ChannelLogo code={ch.code} name={ch.name} />
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold text-ink-900">{ch.name}</div>
                  <div className="text-[11.5px] text-ink-400">{s.dormant.line(relativeTime(ch.lastSyncAt))}</div>
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
