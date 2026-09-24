import Link from "next/link";
import { Clock, Send, RefreshCw } from "lucide-react";
import { getWaitlist, type WaitlistRow } from "@/lib/waitlist";
import { removeWaitlistEntry, sweepWaitlistForm } from "@/lib/actions-waitlist";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@revio/ui/stat-card";
import type { WaitlistStatus } from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { waitlist as waitlistDict, type WaitlistStrings } from "@/lib/i18n/waitlist";
import { getProperty } from "@/lib/data";

export const dynamic = "force-dynamic";

const TABS = ["waiting", "offered", "converted", "expired", "all"] as const;

const TONE: Record<string, Tone> = {
  waiting: "info",
  offered: "warning",
  converted: "success",
  expired: "neutral",
  cancelled: "neutral",
};

/** A rate as a whole percent. Rates arrive as 0–1, never pre-multiplied. */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const active = (TABS.find((k) => k === sp.status) ?? "waiting") as WaitlistStatus | "all";
  const { rows, counts, recovered, metrics } = await getWaitlist(active === "all" ? undefined : active);
  const [{ t: tr, money, day }, property] = await Promise.all([i18n(), getProperty()]);
  const t = tr(waitlistDict);
  /** Minutes in the units a person would actually say them in. */
  const waitDuration = (minutes: number): string => {
    if (minutes < 60) return t.duration.min(minutes);
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t.duration.hours(hours);
    return t.duration.days(Math.round(hours / 24));
  };
  // The hotel's clock — an offer "held until 11:00" means 11:00 where the guest is booking.
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: property.timezone });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <form action={sweepWaitlistForm}>
            <button className="flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <RefreshCw className="h-3.5 w-3.5" /> {t.check}
            </button>
          </form>
        }
      />

      {/*
        One number worth leading with. Counted from real reservations rather than from the entry
        rows, because an entry says an offer was accepted and a reservation says money exists.
      */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          tone="success"
          label={t.recovered}
          value={money(recovered.valueMinor, recovered.currency)}
          sub={t.recoveredSub(recovered.count)}
        />
        <StatCard tone="brand" label={t.tabs.waiting} value={String(counts.waiting)} sub={t.waitingSub} />
        <StatCard
          tone="warning"
          label={t.tabs.offered}
          value={String(counts.offered)}
          sub={t.offeredSub}
        />
        <StatCard
          tone="neutral"
          label={t.tabs.converted}
          value={String(counts.converted)}
          /*
           * The rate, not the word "all time".
           *
           * `offerConversionRate` is converted ÷ **offered**, which measures the offer itself — the
           * wording, the four-hour window, the claim link. Dividing by every entry instead would
           * mostly measure how often the hotel gets a cancellation, and would read as a failure of
           * this feature on a month when nothing came free.
           */
          sub={
            metrics.offerConversionRate == null
              ? t.noOffers
              : t.offersTaken(pct(metrics.offerConversionRate))
          }
        />
      </div>

      {/*
        The second rate, and the wait, deliberately below the cards rather than in them.

        `demandRecoveryRate` is converted ÷ every entry, and it is mostly a statement about how often
        rooms come free — not about how well this works. It belongs on the page, because "how much
        demand did we fail to serve" is a real question, but it does not belong beside a number a
        reader will take as a scorecard.
      */}
      {metrics.entries > 0 && (
        <p className="text-[12px] text-ink-500">
          {t.summary(metrics.offersMade, metrics.offered, metrics.entries)}
          {metrics.demandRecoveryRate != null && t.recoveryRate(pct(metrics.demandRecoveryRate))}
          {metrics.medianMinutesToOffer != null && t.typically(waitDuration(metrics.medianMinutesToOffer))}
          {metrics.convertedWithoutValue > 0 && t.withoutValue(metrics.convertedWithoutValue)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((key) => {
          const n =
            key === "waiting" ? counts.waiting
            : key === "offered" ? counts.offered
            : key === "converted" ? counts.converted
            : key === "expired" ? counts.expired
            : counts.waiting + counts.offered + counts.converted + counts.expired;
          return (
            <Link
              key={key}
              href={`/waitlist?status=${key}`}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold outline-none transition-colors focus-visible:shadow-focus ${
                active === key
                  ? "bg-brand-800 text-white"
                  : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
              }`}
            >
              {t.tabs[key]} <span className="tnum opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={t.tabs[active as (typeof TABS)[number]] ?? t.tabs.waiting}
          subtitle={t.listSubtitle}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-7 w-7" />}
            title={t.emptyTitle}
            body={t.emptyBody}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">{t.cols.guest}</th>
                  <th className="px-4 py-2.5 font-semibold">{t.cols.dates}</th>
                  <th className="px-4 py-2.5 font-semibold">{t.cols.room}</th>
                  <th className="px-4 py-2.5 font-semibold">{t.cols.waiting}</th>
                  <th className="px-4 py-2.5 font-semibold">{t.cols.status}</th>
                  <th className="px-4 py-2.5 font-semibold">{t.cols.offers}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => (
                  <Row key={r.id} r={r} t={t} day={day} clock={(d) => clock.format(d)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function waitingSince(d: Date, t: WaitlistStrings): string {
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (h < 1) return t.since.justNow;
  if (h < 24) return t.since.hours(h);
  return t.since.days(Math.floor(h / 24));
}

function Row({ r, t, day, clock }: { r: WaitlistRow; t: WaitlistStrings; day: (iso: string) => string; clock: (d: Date) => string }) {
  return (
    <tr className="transition-colors hover:bg-surface-page">
      <td className="px-4 py-2.5">
        <div className="font-semibold text-ink-900">{r.guestName}</div>
        <div className="text-[11.5px] text-ink-400">{r.guestEmail}</div>
      </td>
      <td className="tnum px-4 py-2.5 text-ink-700">
        {day(r.checkIn)} → {day(r.checkOut)}
        <div className="text-[11.5px] text-ink-400">{t.stay(r.nights, r.guests)}</div>
      </td>
      {/* NULL room type is "any room that sleeps my party" — the unscoped-means-everything rule. */}
      <td className="px-4 py-2.5 text-ink-700">{r.roomTypeName ?? <span className="text-ink-400">{t.any}</span>}</td>
      <td className="tnum px-4 py-2.5 text-ink-500">{waitingSince(r.createdAt, t)}</td>
      <td className="px-4 py-2.5">
        <StatusPill tone={TONE[r.status] ?? "neutral"}>{t.statuses[r.status] ?? r.status}</StatusPill>
        {r.status === "offered" && r.offerExpiresAt && (
          <div className="mt-0.5 text-[11px] text-ink-400">
            {t.heldUntil(clock(r.offerExpiresAt))}
          </div>
        )}
      </td>
      <td className="tnum px-4 py-2.5 text-ink-500">
        {r.offerCount}
        {/* Say why an entry is sitting still rather than letting it look broken. */}
        {r.offersExhausted && (
          <div className="text-[11px] text-ink-400">{t.exhausted}</div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {r.status === "converted" && r.reservationId ? (
          <Link
            href={`/reservations/${r.reservationId}`}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            <Send className="h-3 w-3" /> {t.booking}
          </Link>
        ) : r.status === "waiting" || r.status === "offered" ? (
          <form action={removeWaitlistEntry} className="inline">
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-md border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-danger-50 hover:text-danger-600">
              {t.remove}
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
