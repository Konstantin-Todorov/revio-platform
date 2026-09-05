import Link from "next/link";
import { Clock, Send, RefreshCw } from "lucide-react";
import { getWaitlist, type WaitlistRow } from "@/lib/waitlist";
import { removeWaitlistEntry, sweepWaitlistForm } from "@/lib/actions-waitlist";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@revio/ui/stat-card";
import type { WaitlistStatus } from "@revio/core";

export const dynamic = "force-dynamic";

const TABS: { key: WaitlistStatus | "all"; label: string }[] = [
  { key: "waiting", label: "Waiting" },
  { key: "offered", label: "Offered" },
  { key: "converted", label: "Converted" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

const TONE: Record<string, Tone> = {
  waiting: "info",
  offered: "warning",
  converted: "success",
  expired: "neutral",
  cancelled: "neutral",
};

function money(minor: number, currency: string) {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${sym}${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A rate as a whole percent. Rates arrive as 0–1, never pre-multiplied. */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Minutes in the units a person would actually say them in. */
function waitDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

function waitingSince(d: Date): string {
  const h = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const active = (TABS.find((t) => t.key === sp.status)?.key ?? "waiting") as WaitlistStatus | "all";
  const { rows, counts, recovered, metrics } = await getWaitlist(active === "all" ? undefined : active);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Waitlist"
        subtitle="Demand on dates you could not sell — and what it turned into"
        action={
          <form action={sweepWaitlistForm}>
            <button className="flex h-9 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <RefreshCw className="h-3.5 w-3.5" /> Check for openings
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
          label="Recovered this month"
          value={money(recovered.valueMinor, recovered.currency)}
          sub={`${recovered.count} ${recovered.count === 1 ? "stay" : "stays"} that would have been lost`}
        />
        <StatCard tone="brand" label="Waiting" value={String(counts.waiting)} sub="on the list now" />
        <StatCard
          tone="warning"
          label="Offered"
          value={String(counts.offered)}
          sub="room held, waiting on the guest"
        />
        <StatCard
          tone="neutral"
          label="Converted"
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
              ? "no offers made yet"
              : `${pct(metrics.offerConversionRate)} of offers taken`
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
          {metrics.offersMade} offer{metrics.offersMade === 1 ? "" : "s"} made to {metrics.offered} of{" "}
          {metrics.entries} {metrics.entries === 1 ? "entry" : "entries"}
          {metrics.demandRecoveryRate != null && (
            <> · {pct(metrics.demandRecoveryRate)} of everyone who joined ended up with a room</>
          )}
          {metrics.medianMinutesToOffer != null && (
            <> · typically {waitDuration(metrics.medianMinutesToOffer)} from joining to an offer</>
          )}
          {metrics.convertedWithoutValue > 0 && (
            <>
              {" "}· {metrics.convertedWithoutValue} converted{" "}
              {metrics.convertedWithoutValue === 1 ? "stay is" : "stays are"} no longer on file, so
              recovered revenue excludes {metrics.convertedWithoutValue === 1 ? "it" : "them"}
            </>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => {
          const n =
            t.key === "waiting" ? counts.waiting
            : t.key === "offered" ? counts.offered
            : t.key === "converted" ? counts.converted
            : t.key === "expired" ? counts.expired
            : counts.waiting + counts.offered + counts.converted + counts.expired;
          return (
            <Link
              key={t.key}
              href={`/waitlist?status=${t.key}`}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold outline-none transition-colors focus-visible:shadow-focus ${
                active === t.key
                  ? "bg-brand-800 text-white"
                  : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
              }`}
            >
              {t.label} <span className="tnum opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={TABS.find((t) => t.key === active)?.label ?? "Waiting"}
          subtitle="Oldest first — position in the queue is the order they joined, never a stored number"
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-7 w-7" />}
            title="Nobody on the list"
            body="When a guest searches dates you cannot sell, your booking page offers to tell them if a room opens. Anyone who takes that up appears here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Guest</th>
                  <th className="px-4 py-2.5 font-semibold">Dates</th>
                  <th className="px-4 py-2.5 font-semibold">Room</th>
                  <th className="px-4 py-2.5 font-semibold">Waiting</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Offers</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ r }: { r: WaitlistRow }) {
  return (
    <tr className="transition-colors hover:bg-surface-page">
      <td className="px-4 py-2.5">
        <div className="font-semibold text-ink-900">{r.guestName}</div>
        <div className="text-[11.5px] text-ink-400">{r.guestEmail}</div>
      </td>
      <td className="tnum px-4 py-2.5 text-ink-700">
        {r.checkIn} → {r.checkOut}
        <div className="text-[11.5px] text-ink-400">
          {r.nights} {r.nights === 1 ? "night" : "nights"} · {r.guests}{" "}
          {r.guests === 1 ? "guest" : "guests"}
        </div>
      </td>
      {/* NULL room type is "any room that sleeps my party" — the unscoped-means-everything rule. */}
      <td className="px-4 py-2.5 text-ink-700">{r.roomTypeName ?? <span className="text-ink-400">Any</span>}</td>
      <td className="tnum px-4 py-2.5 text-ink-500">{waitingSince(r.createdAt)}</td>
      <td className="px-4 py-2.5">
        <StatusPill tone={TONE[r.status] ?? "neutral"}>{r.status}</StatusPill>
        {r.status === "offered" && r.offerExpiresAt && (
          <div className="mt-0.5 text-[11px] text-ink-400">
            held until {r.offerExpiresAt.toISOString().slice(11, 16)}
          </div>
        )}
      </td>
      <td className="tnum px-4 py-2.5 text-ink-500">
        {r.offerCount}
        {/* Say why an entry is sitting still rather than letting it look broken. */}
        {r.offersExhausted && (
          <div className="text-[11px] text-ink-400">no more — 3 lapsed</div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {r.status === "converted" && r.reservationId ? (
          <Link
            href={`/reservations/${r.reservationId}`}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            <Send className="h-3 w-3" /> Booking
          </Link>
        ) : r.status === "waiting" || r.status === "offered" ? (
          <form action={removeWaitlistEntry} className="inline">
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-md border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-danger-50 hover:text-danger-600">
              Remove
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
