import { AlertTriangle } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/primitives";
import { SubmitButton } from "@revio/ui/submit-button";
import {
  operatorPauseChannel, operatorResumeChannel, operatorDisconnectChannel,
  operatorReconnectChannel, operatorDeleteChannel,
} from "@/lib/actions-channels";
import { DeleteChannel } from "./DeleteChannel";

/**
 * One client's channels, as something you can act on.
 *
 * ## What was here before
 *
 * Four numbers: channels connected, last sync, open errors, room types. Every one of them true and
 * none of them answerable — "1 / 1 connected · last sync today · 0 open errors" is precisely what
 * Chervena Vila displayed while its channel pointed at a property Channex had deleted and reported
 * `success` every five minutes. A count cannot say which channel, what it is doing, or what to do
 * about it, and the console exists to answer the third one.
 *
 * ## The order of the controls is the order of their consequences
 *
 * Pause (reversible, stop-sells the OTA) · Disconnect (stops everything, keeps the mappings) ·
 * Delete (permanent, and refused outright when it would take bookings with it). Delete is last,
 * separated, and never the default.
 */

const STATUS_TONE: Record<string, Tone> = {
  connected: "success", paused: "warning", disconnected: "neutral", error: "danger", pending: "info",
};

/** The channel's own words for what the last audit found — never a column name. */
const CATALOGUE: Record<string, { tone: Tone; label: string; detail: string }> = {
  ok: { tone: "success", label: "listings confirmed", detail: "The channel answered and its room types and rate plans were read." },
  property_missing: {
    tone: "danger",
    label: "property is gone",
    detail:
      "The channel no longer has the property this is connected to. Nothing sent is arriving and nothing can arrive " +
      "back — the syncs reporting success are reaching an empty filter. Reconnect the channel to set it up again.",
  },
  unreadable: {
    tone: "warning",
    label: "could not be read",
    detail:
      "The channel answered with no rate plans at all. That is not the same as having none — a rejected key looks " +
      "identical — so nothing was concluded from it.",
  },
};

const when = (d: Date | null) => {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

export interface ChannelRow {
  id: string;
  name: string;
  code: string;
  status: string;
  mode: string;
  externalPropertyId: string | null;
  lastSyncAt: Date | null;
  errorCount: number;
  catalogueCheckedAt: Date | null;
  catalogueStatus: string | null;
  propertyName: string;
  reservations: number;
  crossWired: { roomTypeName: string; ratePlanName: string; externalRateId: string; checkedAt: Date }[];
}

export function ChannelsPanel({ channels, suspended }: { channels: ChannelRow[]; suspended: boolean }) {
  if (channels.length === 0) {
    return <p className="px-4 py-4 text-[12.5px] text-ink-400">No channels yet. Nothing is being distributed for this client.</p>;
  }

  return (
    <div className="divide-y divide-surface-border/60">
      {/*
        ⚠️ Said once, at the top, because it applies to every row and is the thing most likely to be
        assumed wrong. Suspension stops our syncing; it does not take inventory off the OTA. Whoever
        suspended the account has to decide about that separately, and Pause is the control for it.
      */}
      {suspended && (
        <div className="bg-warning-50 px-4 py-3 text-[12.5px] text-warning-800">
          <span className="font-semibold">This account is suspended, so nothing syncs</span> — no prices out, no bookings in.
          That does <span className="font-semibold">not</span> take their rooms off the OTAs: whatever was last published is
          still on sale, and a guest can still book a room into an account nobody at the hotel can sign in to.
          Pause a channel below to stop-sell it.
        </div>
      )}

      {channels.map((ch) => {
        const cat = ch.catalogueStatus ? CATALOGUE[ch.catalogueStatus] : null;
        /*
          ⚠️ The "cannot be removed" sentence is shown only when somebody would be reaching for
          delete — a channel that is disconnected, pointed at a property that is gone, or on a
          suspended account. Printed under every healthy row it was four repetitions of an apology
          for something nobody was trying to do, which is exactly the clutter that teaches people to
          stop reading a screen. On a working channel the facts already say it: "Bookings taken 1".
        */
        const mightWantGone = ch.status === "disconnected" || ch.catalogueStatus === "property_missing" || suspended;

        const controls = (
          <>
            {ch.status === "paused" ? (
              /*
                ⚠️ No Resume while the account is suspended, because resuming cannot work: it would
                mark the channel connected and then be refused the re-push that lifts the stop-sell,
                leaving a channel that reads live and sells nothing. The server refuses it too; this
                is so nobody is invited to press a button that cannot succeed.
              */
              suspended ? (
                <span className="max-w-xs text-[11.5px] leading-snug text-ink-400">
                  Reinstate the account to resume — resuming now would reopen the channel without republishing anything.
                </span>
              ) : (
                <form action={operatorResumeChannel}>
                  <input type="hidden" name="channelId" value={ch.id} />
                  <SubmitButton className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
                    Resume
                  </SubmitButton>
                </form>
              )
            ) : ch.status === "connected" ? (
              <form action={operatorPauseChannel}>
                <input type="hidden" name="channelId" value={ch.id} />
                <SubmitButton
                  title="Stop-sells this channel at the OTA. Reversible; mappings are untouched."
                  className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-warning-600 hover:text-warning-700"
                >
                  Pause
                </SubmitButton>
              </form>
            ) : null}

            {ch.status === "disconnected" ? (
              <form action={operatorReconnectChannel}>
                <input type="hidden" name="channelId" value={ch.id} />
                <SubmitButton className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
                  Reconnect
                </SubmitButton>
              </form>
            ) : (
              <form action={operatorDisconnectChannel}>
                <input type="hidden" name="channelId" value={ch.id} />
                <SubmitButton
                  title="Stops all traffic both ways. Mappings are kept, so reconnecting restores them."
                  className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-ink-400 hover:text-ink-800"
                >
                  Disconnect
                </SubmitButton>
              </form>
            )}

            <DeleteChannel
              channelId={ch.id}
              name={ch.name}
              propertyName={ch.propertyName}
              reservations={ch.reservations}
              explainRefusal={mightWantGone}
              action={operatorDeleteChannel}
            />
          </>
        );

        return (
          <div key={ch.id} className="px-4 py-3.5">
            {/* Identity left, controls right, on one line — the shape of every row of settings
                anybody has used. They stack at narrow widths rather than crushing. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-ink-900">{ch.propertyName}</span>
                <span className="text-ink-300">·</span>
                <span className="text-[13px] font-semibold text-ink-700">{ch.name}</span>
                <StatusPill tone={STATUS_TONE[ch.status] ?? "neutral"}>{ch.status}</StatusPill>
                {ch.mode === "mock"
                  ? <StatusPill tone="neutral">demo connection</StatusPill>
                  : <StatusPill tone="info">{ch.mode === "channex_prod" ? "Channex production" : "Channex sandbox"}</StatusPill>}
                {cat && <span title={cat.detail}><StatusPill tone={cat.tone}>{cat.label}</StatusPill></span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">{controls}</div>
            </div>

            {cat && cat.tone === "danger" && (
              <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-snug text-danger-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{cat.detail}</span>
              </p>
            )}

            {/*
              A cross-wire has no other symptom: the mapping reads `mapped`, the push succeeds, and
              one room's prices publish against another. Only the channel's own catalogue says so.
            */}
            {ch.crossWired.length > 0 && (
              <p className="mt-1.5 flex gap-1.5 text-[12.5px] leading-snug text-danger-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {ch.crossWired.length === 1 ? "One rate plan is" : `${ch.crossWired.length} rate plans are`} publishing to
                  the wrong room: {ch.crossWired.map((f) => `${f.roomTypeName} · ${f.ratePlanName}`).join(", ")}. The mapping
                  looks finished and every push succeeds.
                </span>
              </p>
            )}

            <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-500">
              <div><dt className="inline text-ink-400">Last sync </dt><dd className="inline font-semibold text-ink-700">{when(ch.lastSyncAt)}</dd></div>
              {/*
                ⚠️ Only for a channel we actually ask. A demo connection has no catalogue on the
                other side, so the audit skips it — and printing "Listings checked never" against it
                reads as a thing that has been neglected rather than a thing that does not apply.
                A screen that invents work is worse than one that stays quiet.
              */}
              {ch.mode !== "mock" && (
                <div><dt className="inline text-ink-400">Listings checked </dt><dd className="inline font-semibold text-ink-700">{when(ch.catalogueCheckedAt)}</dd></div>
              )}
              <div><dt className="inline text-ink-400">Bookings taken </dt><dd className="tnum inline font-semibold text-ink-700">{ch.reservations}</dd></div>
              {ch.errorCount > 0 && (
                <div><dt className="inline text-ink-400">Open errors </dt><dd className="tnum inline font-semibold text-danger-600">{ch.errorCount}</dd></div>
              )}
              {ch.externalPropertyId && (
                <div>
                  <dt className="inline text-ink-400">Their property id </dt>
                  {/* The id to quote when the channel says "not found". Selectable in one click. */}
                  <dd className="tnum inline select-all font-mono text-[10.5px] font-semibold text-ink-700">{ch.externalPropertyId}</dd>
                </div>
              )}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
