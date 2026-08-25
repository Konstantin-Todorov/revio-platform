import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarRange, Layers, TrendingUp } from "lucide-react";
import { hasFinishedSetup } from "@revio/core";
import { SetupChecklist } from "@revio/ui/setup-checklist";
import { prisma } from "@/lib/db";
import { getInventoryBoard, getProperty, getScope } from "@/lib/data";
import { getSetup } from "@/lib/setup";
import { buildActionAlerts, getForecast, getOperations, getRangeMetrics, resolveRange, comparisonRange, type CompareBasis, type RangePreset } from "@/lib/metrics";
import { DashboardView, type KpiCard } from "@/components/dashboard/DashboardView";
import { ensurePickupSnapshot } from "@/lib/pickup";
import { releaseExpiredHolds } from "@/lib/holds";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money, FORECAST_DISCLAIMER } from "@/lib/format";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Donut } from "@/components/reports/Visuals";
import { isCommissionFreeCategory } from "@revio/core";

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
  searchParams: Promise<{ range?: string; from?: string; to?: string; basis?: string }>;
}) {
  const sp = await searchParams;

  /**
   * A hotel that has never configured anything goes into the guided flow instead of a dashboard of
   * zeros. Two conditions, and the second matters more: they must not have finished setup AND have
   * no room types at all. Redirecting on `setupCompleted` alone would trap an established hotel that
   * simply never clicked the last screen — including both demo tenants — in a flow they do not need.
   */
  const property = await getProperty();
  if (!hasFinishedSetup(property.setupCompleted, "RevioCRS")) {
    const roomTypeCount = await prisma.roomType.count({ where: { propertyId: property.id } });
    if (roomTypeCount === 0) redirect("/welcome/property");
  }

  await Promise.all([ensurePickupSnapshot(), releaseExpiredHolds()]);

  const [ops, scope, setup] = await Promise.all([getOperations(), getScope(), getSetup()]);
  const range = resolveRange(ops.todayIso, sp.range, sp.from, sp.to);
  // Comparison basis (§1.2): one toggle governs every card. YoY = 364d back, LW = 7d back.
  const basis: CompareBasis = sp.basis === "lw" ? "lw" : "yoy";
  const basisLabel = basis === "lw" ? "LW" : "YoY";
  const isGroup = scope.scope === "group";
  const [metrics, stly, board, f7, f30] = await Promise.all([
    getRangeMetrics(range),
    getRangeMetrics(comparisonRange(range, basis)), // YoY=364d (STLY) or LW=7d, per the toggle
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

  // Relative % for money/counts, percentage-POINT delta for rates — each labelled with its basis (§1.1).
  const relYoy = (now: number, then: number): KpiCard["yoy"] =>
    then <= 0 ? null : { text: `${now >= then ? "+" : ""}${(((now - then) / then) * 100).toFixed(0)}% ${basisLabel}`, dir: now > then ? "up" : now < then ? "down" : "flat" };
  const ppYoy = (now: number, then: number): KpiCard["yoy"] =>
    ({ text: `${now >= then ? "+" : ""}${(now - then).toFixed(1)}pp ${basisLabel}`, dir: now > then ? "up" : now < then ? "down" : "flat" });

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

  /*
   * The hero trend never renders blank (§1.2).
   *
   * On the default "Today" view the range is one day, so `perDay` had a single point and the chart
   * showed "pick a multi-day range to see the daily trend" — a blank box in the best space on the
   * page, pushing the content that works below the fold. A dashboard's hero must show the shape of
   * the business ON LOAD; the date control then refines it.
   *
   * So a short range falls back to a 30-day window. The fallback is labelled on the card, because a
   * chart showing a different period from the KPI row above it, without saying so, is worse than a
   * blank one.
   */
  const trendIsFallback = metrics.perDay.length < 2;
  const trendMetrics = trendIsFallback
    ? await getRangeMetrics(resolveRange(ops.todayIso, "l28d"))
    : metrics;
  const series = trendMetrics.perDay.slice(0, 62);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`${isGroup ? `${scope.label}` : ops.property.name} · ${range.label}`}
        action={
          <Link href="/reports" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <TrendingUp className="h-3.5 w-3.5" /> Reports
          </Link>
        }
      />

      {/* First run: the shortest honest path to taking a booking. Gone for good once complete. */}
      {setup.show && (
        <SetupChecklist
          productName="RevioCRS"
          promise="Four steps and you can take, price and invoice a booking."
          steps={setup.steps}
          done={setup.done}
          total={setup.total}
        />
      )}

      {/* Date selector + KPI grid — per-user customizable, YoY vs STLY-364 on every card. */}
      <DashboardView
        presets={PRESETS}
        activePreset={range.preset}
        cards={cards}
        basis={basis}
        customStart={range.preset === "custom" ? range.start : ""}
        customEnd={range.preset === "custom" ? range.endExcl.slice(0, 10) : ""}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Occupancy + revenue per day */}
        <Card>
          <CardHeader
            title="Occupancy & revenue by day"
            subtitle={
              trendIsFallback
                ? "Last 28 days — pick a multi-day range above to match the KPIs"
                : `${series.length} days${trendMetrics.perDay.length > 62 ? " (first 62 shown)" : ""}`
            }
          />
          <TrendChart
            points={series.map((d) => ({ date: d.date, occupancyPct: d.occupancyPct, revenueMinor: d.revenueMinor }))}
            currency={currency}
            revenueBasis={c.revenueDisplay}
          />
        </Card>

        {/* §1.3 — source mix is a COMPOSITION question ("where does my business come from, and what
             does each channel net me"), and it was two fill-bars, which loses the whole. A donut
             shows the shares; the note on each row carries the commercial half — direct at ~0%
             against an OTA at 15–18% is the strongest argument this product has, and it was absent. */}
        <Card>
          <CardHeader title="Source mix" subtitle="Revenue share, and what each channel costs you" />
          {metrics.sourceMix.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-500">No sold reservations in this range yet.</div>
          ) : (
            <Donut
              centreLabel={money(metrics.sourceMix.reduce((t, x) => t + x.revenueMinor, 0), currency)}
              centreSub="revenue"
              slices={metrics.sourceMix.map((src) => {
                const row = metrics.economics.rows.find((r) => r.sourceName === src.name);
                const free = row ? isCommissionFreeCategory(row.category) : false;
                const unset = !!row && !free && row.commissionMinor == null;
                return {
                  label: src.name,
                  value: src.revenueMinor,
                  valueLabel: money(src.revenueMinor, currency),
                  // Never render an unconfigured rate as "no commission" — the §2.5 lesson, which is
                  // the same mistake one screen over.
                  note: free ? "no commission" : unset ? "rate not set" : row ? `${row.commissionPct}% commission` : undefined,
                  noteTone: unset ? "warning" : "muted",
                };
              })}
            />
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
          <div className="overflow-x-auto">
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
          </div>
          <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
            {FORECAST_DISCLAIMER}
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
