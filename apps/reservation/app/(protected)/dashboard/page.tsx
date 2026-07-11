import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarRange, Layers, TrendingUp } from "lucide-react";
import { getInventoryBoard, getScope } from "@/lib/data";
import { buildActionAlerts, getForecast, getOperations, getRangeMetrics, resolveRange, stlyRange, type RangePreset } from "@/lib/metrics";
import { DashboardView, type KpiCard } from "@/components/dashboard/DashboardView";
import { ensurePickupSnapshot } from "@/lib/pickup";
import { releaseExpiredHolds } from "@/lib/holds";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

// Spec §3.1 presets. L* = actuals (realized past); N* = on-the-books (confirmed future).
// 28 = four whole weeks — never "tidy" back to 30 (day-of-week comparability).
const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "l7d", label: "L7D" },
  { key: "l28d", label: "L28D" },
  { key: "ytd", label: "YTD" },
  { key: "n7d", label: "N7D" },
  { key: "n28d", label: "N28D" },
];

const pct = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1)}%`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  await Promise.all([ensurePickupSnapshot(), releaseExpiredHolds()]);

  const [ops, scope] = await Promise.all([getOperations(), getScope()]);
  const range = resolveRange(ops.todayIso, sp.range, sp.from, sp.to);
  const isGroup = scope.scope === "group";
  const [metrics, stly, board, f7, f30] = await Promise.all([
    getRangeMetrics(range),
    getRangeMetrics(stlyRange(range)), // STLY = 364 days back, same weekday (spec §4.2)
    getInventoryBoard({ days: 14 }),
    getForecast(ops.todayIso, 7),
    getForecast(ops.todayIso, 30),
  ]);
  const alerts = buildActionAlerts({
    board,
    threshold: ops.defaults?.lowAvailabilityThreshold ?? 2,
    failedSyncs24h: ops.failedSyncs24h,
    openErrors: ops.openErrors,
  });
  const c = metrics.cards;
  const s = stly.cards;
  const currency = ops.property.baseCurrency;
  // Past = actuals; future = on-the-books language (confirmed only — no realized occupancy yet).
  const otb = range.kind === "future";

  // YoY vs STLY: relative % for money/counts, percentage-POINT delta for rates.
  const relYoy = (now: number, then: number): KpiCard["yoy"] =>
    then <= 0 ? null : { text: `${now >= then ? "+" : ""}${(((now - then) / then) * 100).toFixed(0)}%`, dir: now > then ? "up" : now < then ? "down" : "flat" };
  const ppYoy = (now: number, then: number): KpiCard["yoy"] =>
    ({ text: `${now >= then ? "+" : ""}${(now - then).toFixed(1)}pp`, dir: now > then ? "up" : now < then ? "down" : "flat" });

  const cards: KpiCard[] = [
    { key: "occupancy", label: otb ? "Committed occupancy" : "Occupancy", value: pct(c.occupancyPct), sub: `${c.roomsSoldNights} of ${c.availableRoomNights} room-nights`, href: "/inventory", yoy: ppYoy(c.occupancyPct, s.occupancyPct) },
    { key: "sold", label: otb ? "Rooms on the books" : "Rooms sold", value: String(c.roomsSoldNights), sub: "room-nights in range", href: "/reservations", yoy: relYoy(c.roomsSoldNights, s.roomsSoldNights) },
    { key: "available", label: "Rooms available", value: String(c.availableRoomNights), sub: "physical − OOO − closed", href: "/rooms-rates", yoy: relYoy(c.availableRoomNights, s.availableRoomNights) },
    { key: "revenue", label: otb ? `Revenue on the books (${c.revenueDisplay})` : `Room revenue (${c.revenueDisplay})`, value: money(c.revenueMinor, currency), sub: "accommodation only", href: "/reports?report=performance", yoy: relYoy(c.revenueMinor, s.revenueMinor) },
    { key: "adr", label: "ADR", value: money(c.adrMinor, currency), sub: "revenue ÷ rooms sold", href: "/reports?report=performance", yoy: relYoy(c.adrMinor, s.adrMinor) },
    { key: "revpar", label: "RevPAR", value: money(c.revparMinor, currency), sub: "the #1 hotel KPI", href: "/reports?report=performance", yoy: relYoy(c.revparMinor, s.revparMinor) },
    { key: "cancellation", label: "Cancellation rate", value: pct(c.cancellationRatePct), sub: `${c.cancelledCount} of ${c.createdCount} created`, href: "/reservations?status=cancelled", yoy: ppYoy(c.cancellationRatePct, s.cancellationRatePct) },
    { key: "pickup", label: "Pickup · 30d", value: (c.pickup.value >= 0 ? "+" : "") + c.pickup.value, sub: c.pickup.vsDate ? `room-nights vs ${c.pickup.vsDate}` : "baseline recorded today", href: "/reports?report=pickup", yoy: null },
  ];

  const series = metrics.perDay.slice(0, 62);
  const maxRevenue = Math.max(1, ...series.map((d) => d.revenueMinor));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`${isGroup ? `${scope.label}` : ops.property.name} · ${range.label} · every number from the shared formula sheet`}
        action={
          <Link href="/reports" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <TrendingUp className="h-3.5 w-3.5" /> Reports
          </Link>
        }
      />

      {/* Date selector + KPI grid — per-user customizable, YoY vs STLY-364 on every card. */}
      <DashboardView
        presets={PRESETS}
        activePreset={range.preset}
        cards={cards}
        customStart={range.preset === "custom" ? range.start : ""}
        customEnd={range.preset === "custom" ? range.endExcl.slice(0, 10) : ""}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Occupancy + revenue per day */}
        <Card>
          <CardHeader title={`Occupancy & revenue by day${metrics.perDay.length > 62 ? " (first 62 days)" : ""}`} />
          {series.length <= 1 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">Pick a multi-day range to see the daily trend.</div>
          ) : (
            <div className="px-4 py-4">
              <div className="flex h-28 items-end gap-[2px]">
                {series.map((d) => (
                  <div key={d.date} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-brand-600/80 transition-colors group-hover:bg-brand-700"
                      style={{ height: `${Math.max(2, d.occupancyPct)}%` }}
                      title={`${d.date} · ${d.occupancyPct.toFixed(0)}% · ${money(d.revenueMinor, currency)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-ink-400">
                <span>{series[0]!.date}</span>
                <span>occupancy % per day · hover for revenue</span>
                <span>{series[series.length - 1]!.date}</span>
              </div>
              <div className="mt-3 flex h-14 items-end gap-[2px]">
                {series.map((d) => (
                  <div key={d.date} className="flex-1">
                    <div
                      className="w-full rounded-t bg-warning-500/70"
                      style={{ height: `${Math.max(2, (d.revenueMinor / maxRevenue) * 100)}%` }}
                      title={`${d.date} · ${money(d.revenueMinor, currency)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 text-center text-[10px] text-ink-400">revenue per day ({c.revenueDisplay})</div>
            </div>
          )}
        </Card>

        {/* Source mix */}
        <Card>
          <CardHeader title="Source mix — revenue share" />
          {metrics.sourceMix.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">No sold reservations in this range yet.</div>
          ) : (
            <ul className="space-y-2.5 px-4 py-4">
              {metrics.sourceMix.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold text-ink-900">{s.name}</span>
                    <span className="tnum text-ink-500">
                      {s.reservations} res · {s.roomNights} rn · {money(s.revenueMinor, currency)} · {pct(s.sharePct)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, s.sharePct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {isGroup && (
        <div className="flex items-start gap-2 rounded-md border border-brand-600/25 bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-800">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            <span className="font-semibold">Portfolio view.</span> KPIs, charts, source mix and forecast above sum across all {scope.count} properties
            (ratios recomputed from combined totals). The operational lists below auto-select <span className="font-semibold">{ops.property.name}</span> —
            switch to a single property to act on its arrivals, alerts and bookings.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Action Center */}
        <Card>
          <CardHeader title="Action Center" />
          {alerts.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">Nothing needs attention — no overbookings, sell-outs or sync failures.</div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors hover:bg-surface-muted">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.severity === "critical" ? "bg-danger-500" : a.severity === "warning" ? "bg-warning-500" : "bg-brand-600"}`} />
                    <span className={a.severity === "critical" ? "font-semibold text-danger-600" : "text-ink-700"}>{a.message}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
            Thresholds are Settings (low availability ≤ {ops.defaults?.lowAvailabilityThreshold ?? 2}) — tune them under Rates → Property defaults.
          </p>
        </Card>

        {/* Forecast */}
        <Card>
          <CardHeader title="Forecast — the same data read forward" />
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Window</th>
                <th className="px-4 py-2.5 text-right">Occupancy</th>
                <th className="px-4 py-2.5 text-right">Room-nights</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
                <th className="px-4 py-2.5 text-right">Arrivals</th>
                <th className="px-4 py-2.5 text-right">Departures</th>
              </tr>
            </thead>
            <tbody>
              {[f7, f30].map((f) => (
                <tr key={f.days} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">Next {f.days} days</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-700">{pct(f.occupancyPct)}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-700">{f.roomsSoldNights}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(f.revenueMinor, currency)}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-700">{f.arrivals}</td>
                  <td className="tnum px-4 py-2.5 text-right text-ink-700">{f.departures}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
            Expected values from confirmed bookings — not a prediction model.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Arrivals today (${ops.arrivals.length}) · Departures today (${ops.departures.length})`} />
          {ops.arrivals.length === 0 && ops.departures.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">No arrivals or departures today.</div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {ops.arrivals.map((l) => (
                <li key={`a-${l.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
                  <ArrowDownLeft className="h-4 w-4 shrink-0 text-success-600" />
                  <Link href={`/reservations/${l.reservation.id}`} className="font-semibold text-brand-700 hover:underline">{l.reservation.guestName}</Link>
                  <span className="ml-auto text-ink-500">{l.roomType.name}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
                </li>
              ))}
              {ops.departures.map((l) => (
                <li key={`d-${l.id}`} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-400" />
                  <Link href={`/reservations/${l.reservation.id}`} className="font-semibold text-brand-700 hover:underline">{l.reservation.guestName}</Link>
                  <span className="ml-auto text-ink-500">{l.roomType.name}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="New & cancelled · last 24h" action={<Link href="/reservations" className="text-[12px] font-semibold text-brand-700 hover:underline">All reservations</Link>} />
          {ops.newRes.length === 0 && ops.cancelledRes.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">No booking activity in the last 24 hours.</div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {ops.newRes.map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
                  <StatusPill tone={r.status === "cancelled" ? "neutral" : "success"}>{r.status === "cancelled" ? "cancelled" : "new"}</StatusPill>
                  <Link href={`/reservations/${r.id}`} className="font-semibold text-brand-700 hover:underline">{r.guestName}</Link>
                  <span className="ml-auto text-ink-500">{r.lines[0]?.roomType.name ?? "—"} · {money(r.totalMinor, r.currency)}</span>
                </li>
              ))}
              {ops.cancelledRes.filter((r) => !ops.newRes.some((n) => n.id === r.id)).map((r) => (
                <li key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
                  <StatusPill tone="neutral">cancelled</StatusPill>
                  <Link href={`/reservations/${r.id}`} className="font-semibold text-brand-700 hover:underline">{r.guestName}</Link>
                  <span className="ml-auto text-ink-500">{r.lines[0]?.roomType.name ?? "—"} · {money(r.totalMinor, r.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Avg length of stay {c.avgLosNights.toFixed(1)} nights · avg lead time {c.avgLeadDays.toFixed(0)} days ·
        no-shows {ops.defaults?.countNoShowsAsSold === false ? "excluded from" : "count as"} sold ·{" "}
        <Link href="/inventory" className="font-semibold text-brand-700 hover:underline"><CalendarRange className="mr-0.5 inline h-3 w-3" />Inventory Calendar</Link>
      </p>
    </div>
  );
}
