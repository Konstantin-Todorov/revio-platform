import { ArrowRight, Clock, Info, TrendingDown } from "lucide-react";
import { BarList, Donut } from "@/components/reports/Visuals";
import type { FunnelSession } from "@revio/core";
import { funnelByRoomType, funnelStayComparison, funnelTotals } from "@revio/core";
import { bookingEngine, type BookingEngineStrings } from "@/lib/i18n/booking-engine";

/**
 * The hotel's own funnel, on the hotel's own screen.
 *
 * ## What it is answering
 *
 * An owner who has switched on RevioDirect is asking one question — *is this working?* — and until
 * now the only available answer was the number of direct bookings, which says nothing about the
 * ones that got away. The holds table has always known: every guest who opened a booking form left
 * a record saying whether they finished.
 *
 * ## Two readings that are deliberately kept apart
 *
 * **Left** (pressed back) and **ran out of time** are both "did not book" and they mean opposite
 * things. Somebody who saw the total and left is telling you about your price or your trust
 * signals. Somebody who was interrupted is telling you nothing bad at all — and is the one an email
 * can still win back. Summed into one "abandoned" figure, the hotel cannot tell which fix to make,
 * which is the whole point of measuring.
 *
 * **Still deciding** is never counted as a loss. It sits beside the ring rather than in it.
 */
export function FunnelPanel({
  sessions,
  roomTypeName,
  inferred,
  s = bookingEngine.en.funnel,
}: {
  sessions: FunnelSession[];
  roomTypeName: Map<string, string>;
  /** The range reaches back before the source was recorded — say so rather than imply precision. */
  inferred: boolean;
  /** The reader's words; English when omitted. A server component, so the page passes them in. */
  s?: BookingEngineStrings["funnel"];
}) {
  const t = funnelTotals(sessions);

  if (t.started === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[13px] font-semibold text-ink-700">{s.emptyTitle}</p>
        <p className="mt-1 text-[12.5px] text-ink-500">
          {s.emptyBody}
        </p>
      </div>
    );
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const stay = funnelStayComparison(sessions);
  const rooms = funnelByRoomType(sessions);

  return (
    <div className="space-y-5 px-4 py-4">
      {/* The headline, and the two ways it can go wrong, on one line. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-center">
        <Donut
          centreLabel={t.conversionRate === null ? "—" : pct(t.conversionRate)}
          centreSub={t.conversionRate === null ? s.nobodyDecided : s.booked}
          slices={[
            { label: s.booked.charAt(0).toUpperCase() + s.booked.slice(1), value: t.booked, valueLabel: String(t.booked), colour: "var(--success-600, #16a34a)" },
            { label: s.left, value: t.left, valueLabel: String(t.left), colour: "var(--warning-600, #d97706)" },
            { label: s.timedOut, value: t.stopped, valueLabel: String(t.stopped), colour: "var(--ink-300, #cbd5e1)" },
          ]}
        />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={s.opened} value={t.started} hint={s.openedHint} />
          <Stat label={s.booked.charAt(0).toUpperCase() + s.booked.slice(1)} value={t.booked} tone="success" />
          <Stat
            label={s.leftForm}
            value={t.left}
            tone="warning"
            hint={s.leftHint}
          />
          <Stat
            label={s.ranOut}
            value={t.stopped}
            hint={s.ranOutHint}
          />
        </dl>
      </div>

      {t.looking > 0 && (
        <p className="flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1.5 text-[12px] text-ink-600">
          <Clock className="h-3.5 w-3.5 shrink-0 text-ink-400" />
          <span className="tnum font-semibold">{t.looking}</span>
          {s.looking(t.looking)}
        </p>
      )}

      {/* What the ones who booked wanted, against what the ones who left wanted. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Compare
          title={s.nightsWanted}
          booked={stay.nights.booked}
          abandoned={stay.nights.abandoned}
          unit={s.night}
          why={s.nightsWhy}
          s={s}
        />
        <Compare
          title={s.leadDays}
          booked={stay.leadDays.booked}
          abandoned={stay.leadDays.abandoned}
          unit={s.day}
          why={s.leadWhy}
          s={s}
        />
      </div>

      <div>
        <h4 className="px-0 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          {s.byRoom}
        </h4>
        {/*
          ⚠️ The bar length is the CONVERSION RATE, the same thing the number beside it states — not
          the number of visitors. Drawn the other way, a room with no bookings and plenty of lookers
          got a long bar next to a "0%", and the eye believes the bar. Rows stay ordered by
          attention, and the raw counts ride along in the meta so a 1-of-1 cannot pass for a trend.
        */}
        <BarList
          emptyMessage={s.noRooms}
          data={rooms.map((r) => ({
            label: roomTypeName.get(r.roomTypeId) ?? s.room,
            value: r.conversionRate === null ? 0 : r.conversionRate,
            valueLabel: r.conversionRate === null ? "—" : pct(r.conversionRate),
            meta: s.of(r.booked, r.sessions),
          }))}
        />
        <p className="px-4 pb-1 text-[11.5px] text-ink-400">
          {s.byRoomNote}
        </p>
      </div>

      {inferred && (
        <p className="flex items-start gap-1.5 rounded-md border border-surface-border bg-surface-muted px-2.5 py-2 text-[11.5px] text-ink-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-400" />
          {s.inferred}
        </p>
      )}
    </div>
  );
}

function Stat({
  label, value, hint, tone,
}: { label: string; value: number; hint?: string; tone?: "success" | "warning" }) {
  const colour = tone === "success" ? "text-success-600" : tone === "warning" ? "text-warning-700" : "text-ink-900";
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={`tnum text-[22px] font-bold leading-tight ${colour}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  );
}

function Compare({
  title, booked, abandoned, unit, why, s,
}: { title: string; booked: number | null; abandoned: number | null; unit: (n: number) => string; why: string; s: BookingEngineStrings["funnel"] }) {
  const fmt = (n: number | null) => (n === null ? "—" : unit(n));
  // Only remark on a gap when both sides exist AND it is big enough to act on. A half-night
  // difference is noise, and pointing at it teaches the reader to ignore this box.
  const notable = booked !== null && abandoned !== null && Math.abs(abandoned - booked) >= Math.max(1, booked * 0.5);

  return (
    <div className="rounded-lg border border-surface-border p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{title}</h4>
      <div className="mt-1.5 flex items-center gap-3 text-[13px]">
        <span>
          <span className="tnum font-bold text-success-600">{fmt(booked)}</span>
          <span className="ml-1 text-ink-400">{s.booked}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-ink-300" />
        <span>
          <span className="tnum font-bold text-warning-700">{fmt(abandoned)}</span>
          <span className="ml-1 text-ink-400">{s.didNot}</span>
        </span>
      </div>
      {/* Median, not mean — see funnelStayComparison. */}
      <p className="mt-1 text-[11px] text-ink-400">{s.median}</p>
      {notable && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-600">
          <TrendingDown className="mt-px h-3.5 w-3.5 shrink-0 text-warning-600" />
          {why}
        </p>
      )}
    </div>
  );
}
