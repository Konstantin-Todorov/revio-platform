import Link from "next/link";
import { Download } from "lucide-react";
import { Layers } from "lucide-react";
import { getInventoryBoard } from "@/lib/data";
import { getCancellationReport, getPickupReport, getProductPerformance, getProductionByDay, getRangeMetrics, resolveRange, comparisonRange, type CompareBasis, type RangePreset } from "@/lib/metrics";
import { getProperty, getScope, todayInTz } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { EvolutionChart, type EvoBucket } from "@/components/reports/EvolutionChart";
import { money } from "@/lib/format";
import { isCommissionFreeCategory, availabilityPressure, LOW_AVAILABILITY_SHARE } from "@revio/core";

export const dynamic = "force-dynamic";

// Analytics sub-tabs (spec §3.2) — all CRS-native, derived from reservations + inventory.
// Traffic / conversion / comp-set / review score are deliberately ABSENT (need external data).
const REPORTS = [
  { key: "performance", label: "Performance" },
  { key: "pickup", label: "Pickup & Pace" },
  { key: "source", label: "Source / Channel mix" },
  { key: "products", label: "Room-type & Rate-plan" },
  { key: "cancellation", label: "Cancellations" },
  { key: "otb", label: "On-the-books" },
  { key: "availability", label: "Availability" },
] as const;

const RANGES: { key: RangePreset; label: string }[] = [
  { key: "l7d", label: "L7D" }, { key: "l28d", label: "L28D" }, { key: "ytd", label: "YTD" },
  { key: "n7d", label: "N7D" }, { key: "n28d", label: "N28D" },
];

const pct = (v: number) => `${v.toFixed(1)}%`;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; range?: string; from?: string; to?: string; lens?: string; g?: string; basis?: string }>;
}) {
  const sp = await searchParams;
  const report = REPORTS.some((r) => r.key === sp.report) ? sp.report! : "performance";
  const scope = await getScope();
  const property = scope.primary;
  const isGroup = scope.scope === "group";
  const todayIso = todayInTz(property.timezone);
  const range = resolveRange(todayIso, sp.range ?? "l28d", sp.from, sp.to);
  // Global controls (spec §3.2): Book date vs Stay date lens + granularity, on every sub-tab
  // where the distinction exists. Book = production ("what did we book"); Stay = occupancy.
  const lens: "stay" | "book" = sp.lens === "book" ? "book" : "stay";
  const gran: "d" | "w" | "m" = sp.g === "w" ? "w" : sp.g === "m" ? "m" : "d";
  const basis: CompareBasis = sp.basis === "lw" ? "lw" : "yoy"; // comparison baseline for the summary cards (§2.3)
  const qs = `report=${report}&range=${range.preset}${range.preset === "custom" ? `&from=${sp.from}&to=${sp.to}` : ""}&lens=${lens}`;
  const href = (over: Record<string, string>) => {
    const params = new URLSearchParams({ report, range: range.preset, lens, g: gran, basis, ...over });
    if (range.preset === "custom") { if (sp.from) params.set("from", sp.from); if (sp.to) params.set("to", sp.to); }
    return `/reports?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        subtitle={`${isGroup ? scope.label : property.name} · occupancy, rate and revenue for the period you choose`}
        action={
          <a href={`/api/reports/export?${qs}`} className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            href={href({ report: r.key })}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              report === r.key ? "bg-brand-800 text-white" : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Global controls (spec §3.2): period · book/stay lens · granularity. */}
      {report !== "pickup" && report !== "availability" && report !== "otb" && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-surface-border bg-white px-3 py-2">
          <span className="flex items-center gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={href({ range: r.key })}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  range.preset === r.key ? "bg-brand-50 text-brand-800 ring-1 ring-brand-600/30" : "text-ink-500 hover:bg-surface-muted"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </span>
          <span className="h-4 w-px bg-surface-border" />
          <span className="flex items-center gap-1 text-[11.5px] font-semibold">
            <Link href={href({ lens: "stay" })} className={`rounded-md px-2.5 py-1 transition-colors ${lens === "stay" ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}>Stay date</Link>
            <Link href={href({ lens: "book" })} className={`rounded-md px-2.5 py-1 transition-colors ${lens === "book" ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}>Book date</Link>
            <span className="ml-1 text-[10.5px] font-normal text-ink-400">{lens === "book" ? "production — when it was booked" : "occupancy — when the stay falls"}</span>
          </span>
          {report === "performance" && lens === "stay" && (
            <>
              <span className="h-4 w-px bg-surface-border" />
              <span className="flex items-center gap-1 text-[11.5px] font-semibold">
                {([["d", "Daily"], ["w", "Weekly"], ["m", "Monthly"]] as const).map(([k, l]) => (
                  <Link key={k} href={href({ g: k })} className={`rounded-md px-2.5 py-1 transition-colors ${gran === k ? "bg-brand-50 text-brand-800 ring-1 ring-brand-600/30" : "text-ink-500 hover:bg-surface-muted"}`}>{l}</Link>
                ))}
              </span>
              <span className="h-4 w-px bg-surface-border" />
              <span className="flex items-center gap-1 text-[11.5px] font-semibold">
                <span className="text-[10.5px] font-normal text-ink-400">Compared with</span>
                {([["yoy", "Last year"], ["lw", "Last week"]] as const).map(([k, l]) => (
                  <Link key={k} href={href({ basis: k })} className={`rounded-md px-2.5 py-1 transition-colors ${basis === k ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}>{l}</Link>
                ))}
              </span>
            </>
          )}
        </div>
      )}

      {isGroup && (
        <div className="flex items-start gap-2 rounded-md border border-brand-600/25 bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-800">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span>
            <span className="font-semibold">Portfolio totals across {scope.count} properties.</span> Occupancy, ADR and RevPAR are recomputed
            from combined room-nights and revenue — never averaged.{report === "availability" ? ` The Availability calendar shows ${property.name} only (room types differ per property).` : ""}
          </span>
        </div>
      )}

      {report === "performance" && (lens === "book" ? <ProductionReport range={range} /> : <PerformanceReport range={range} gran={gran} basis={basis} />)}
      {report === "pickup" && <PickupReport />}
      {report === "source" && <SourceReport range={range} />}
      {report === "products" && <ProductsReport range={range} lens={lens} />}
      {report === "cancellation" && <CancellationReport range={range} lens={lens} />}
      {report === "otb" && <OtbReport todayIso={todayIso} />}
      {report === "availability" && <AvailabilityReport />}
    </div>
  );
}

/** Bucket the per-day series into ISO weeks / calendar months (granularity control). */
function bucket(perDay: { date: string; available: number; soldNights: number; revenueMinor: number }[], g: "d" | "w" | "m") {
  if (g === "d") return perDay.map((d) => ({ label: d.date, ...d }));
  const keyOf = (date: string) => {
    if (g === "m") return date.slice(0, 7);
    const dt = new Date(`${date}T00:00:00Z`);
    const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86_400_000);
    return `wk ${monday.toISOString().slice(0, 10)}`;
  };
  const map = new Map<string, { label: string; available: number; soldNights: number; revenueMinor: number }>();
  for (const d of perDay) {
    const k = keyOf(d.date);
    const row = map.get(k) ?? { label: k, available: 0, soldNights: 0, revenueMinor: 0 };
    row.available += d.available;
    row.soldNights += d.soldNights;
    row.revenueMinor += d.revenueMinor;
    map.set(k, row);
  }
  return [...map.values()];
}

/** A period summary card (§2.3): value + basis-labelled delta (green up / red down) + the prior value. */
function SummaryCard({ label, value, delta, prior, hint }: { label: string; value: string; delta: { text: string; up: boolean } | null; prior: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white px-4 py-3.5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        <span>{label}</span>
        {hint && <span title={hint} className="cursor-help select-none text-ink-300 hover:text-ink-500">ⓘ</span>}
      </div>
      <div className="tnum mt-1 text-[22px] font-bold leading-none text-ink-900">{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
        {delta ? (
          <span className={`rounded px-1 py-0.5 font-bold tabular-nums ${delta.up ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-600"}`}>{delta.up ? "▲" : "▼"} {delta.text}</span>
        ) : <span className="text-ink-300">no baseline</span>}
        <span className="text-ink-400">{prior}</span>
      </div>
    </div>
  );
}

/**
 * Analytics Performance — full redesign (CRS-REFINEMENT-R2 §2): a period SUMMARY dashboard (metric cards
 * with Σ/Σ-recomputed ratios + basis-labelled deltas, evolution bar charts, and performance-by-room-type)
 * replaces the one-row-per-day table as the primary view. The raw day table is kept as a drill-down.
 */
async function PerformanceReport({ range, gran, basis }: { range: ReturnType<typeof resolveRange>; gran: "d" | "w" | "m"; basis: CompareBasis }) {
  const [m, cmp, prod] = await Promise.all([
    getRangeMetrics(range),
    getRangeMetrics(comparisonRange(range, basis)), // YoY=364d or LW=7d, ratios recomputed Σ/Σ
    getProductPerformance(range, "stay"),
  ]);
  const currency = m.property.baseCurrency;
  const basisLabel = basis === "lw" ? "LW" : "YoY";
  const rows = bucket(m.perDay, gran);
  const cmpRows = bucket(cmp.perDay, gran);
  const granLabel = gran === "d" ? "daily" : gran === "w" ? "weekly" : "monthly";
  const cmpName = basis === "lw" ? "Last week" : "Last year";
  // Align this-period and comparison buckets by index (same length + granularity) for the combo chart.
  const chart: EvoBucket[] = rows.map((r, i) => {
    const cr = cmpRows[i];
    return {
      label: r.label,
      rnNow: r.soldNights,
      rnThen: cr?.soldNights ?? 0,
      adrNow: r.soldNights > 0 ? r.revenueMinor / r.soldNights / 100 : 0,
      adrThen: cr && cr.soldNights > 0 ? cr.revenueMinor / cr.soldNights / 100 : 0,
    };
  });

  const relDelta = (now: number, then: number) => (then <= 0 ? null : { text: `${now >= then ? "+" : ""}${(((now - then) / then) * 100).toFixed(0)}% ${basisLabel}`, up: now >= then });
  const ppDelta = (now: number, then: number) => ({ text: `${now >= then ? "+" : ""}${(now - then).toFixed(1)}pp ${basisLabel}`, up: now >= then });

  const summary = [
    { label: "Occupancy", value: pct(m.cards.occupancyPct), delta: ppDelta(m.cards.occupancyPct, cmp.cards.occupancyPct), prior: `${cmp.cards.occupancyPct.toFixed(1)}% prior`, hint: "Room-nights sold ÷ room-nights available, for the period. Δ shown in percentage points vs the comparison basis." },
    { label: "ADR", value: money(m.cards.adrMinor, currency), delta: relDelta(m.cards.adrMinor, cmp.cards.adrMinor), prior: `${money(cmp.cards.adrMinor, currency)} prior`, hint: "Average Daily Rate = room revenue ÷ room-nights sold. Recomputed Σ/Σ across the period, not an average of daily ADRs." },
    { label: "RevPAR", value: money(m.cards.revparMinor, currency), delta: relDelta(m.cards.revparMinor, cmp.cards.revparMinor), prior: `${money(cmp.cards.revparMinor, currency)} prior`, hint: "Revenue Per Available Room = room revenue ÷ room-nights available (= ADR × occupancy). The truest single yield metric." },
    { label: `Revenue (${m.cards.revenueDisplay})`, value: money(m.cards.revenueMinor, currency), delta: relDelta(m.cards.revenueMinor, cmp.cards.revenueMinor), prior: `${money(cmp.cards.revenueMinor, currency)} prior`, hint: `Room revenue for the period (${m.cards.revenueDisplay}). Gross = as sold; Net subtracts channel commission — toggled in Settings.` },
    { label: "Room-nights", value: String(m.cards.roomsSoldNights), delta: relDelta(m.cards.roomsSoldNights, cmp.cards.roomsSoldNights), prior: `${cmp.cards.roomsSoldNights} prior`, hint: "Total room-nights sold in the period — the volume behind ADR and occupancy." },
  ];

  return (
    <div className="space-y-4">
      {/* Metric summary cards for the period (§2.3) — each with a hover ⓘ explaining its formula. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {summary.map((c) => <SummaryCard key={c.label} label={c.label} value={c.value} delta={c.delta} prior={c.prior} hint={c.hint} />)}
      </div>

      {/* Combined bar + line evolution chart at the selected granularity (§2.4, matches the reference). */}
      <Card>
        <CardHeader title={`Evolution · ${range.label} · ${granLabel}`} subtitle={`Room-nights (bars) and ADR (lines) — this period vs ${cmpName.toLowerCase()}`} />
        {rows.length <= 1 ? (
          <div className="px-4 py-6 text-[13px] text-ink-500">Pick a multi-day range to see the trend.</div>
        ) : (
          <EvolutionChart data={chart} currency={currency} basisLabel={cmpName} />
        )}
      </Card>

      {/* Performance by room type (§2.5) — compare room types against each other. */}
      <Card>
        <CardHeader title="Performance by room type" subtitle="Room-nights, revenue and ADR per type for the selected period" />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Room type", "Reservations", "Room-nights", "Revenue", "ADR"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {prod.roomTypes.map((row) => (
                <tr key={row.name} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{row.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{row.reservations}</td>
                  <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{row.nights}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{money(row.revenueMinor, currency)}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{row.adrMinor > 0 ? money(row.adrMinor, currency) : "—"}</td>
                </tr>
              ))}
              {prod.roomTypes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-400">No sold nights in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Raw day-level data kept as a drill-down / export (§2.6). */}
      <details className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        <summary className="flex cursor-pointer select-none items-center gap-2 border-b border-surface-border bg-surface-muted/60 px-4 py-2.5 text-[12.5px] font-semibold text-ink-700 [&::-webkit-details-marker]:hidden">
          Detailed {granLabel} data — the numbers behind the charts
        </summary>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {[gran === "d" ? "Date" : gran === "w" ? "Week" : "Month", "Available", "Sold", "Occupancy", "Revenue", "ADR", "RevPAR"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.label} className="border-b border-surface-border/60 last:border-0">
                  <td className="tnum px-4 py-2 text-ink-700">{d.label}</td>
                  <td className="tnum px-4 py-2 text-ink-600">{d.available}</td>
                  <td className="tnum px-4 py-2 font-semibold text-ink-900">{d.soldNights}</td>
                  <td className="tnum px-4 py-2 text-ink-700">{d.available > 0 ? pct((d.soldNights / d.available) * 100) : "—"}</td>
                  <td className="tnum px-4 py-2 text-ink-700">{money(d.revenueMinor, currency)}</td>
                  <td className="tnum px-4 py-2 text-ink-600">{d.soldNights > 0 ? money(Math.round(d.revenueMinor / d.soldNights), currency) : "—"}</td>
                  <td className="tnum px-4 py-2 text-ink-600">{d.available > 0 ? money(Math.round(d.revenueMinor / d.available), currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Book-date lens on Performance: the production curve — what was BOOKED each day. */
async function ProductionReport({ range }: { range: ReturnType<typeof resolveRange> }) {
  const r = await getProductionByDay(range);
  const currency = r.property.baseCurrency;
  return (
    <Card>
      <CardHeader title={`Production · ${range.label} · ${r.totals.bookings} bookings made · ${r.totals.nights} room-nights · ${money(r.totals.revenueMinor, currency)} booked (${r.totals.cancelled} since cancelled)`} />
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Booked on", "Bookings", "Room-nights", "Revenue booked", "Since cancelled"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((d) => (
              <tr key={d.date} className="border-b border-surface-border/60 last:border-0">
                <td className="tnum px-4 py-2 text-ink-700">{d.date}</td>
                <td className="tnum px-4 py-2 font-semibold text-ink-900">{d.bookings}</td>
                <td className="tnum px-4 py-2 text-ink-700">{d.nights}</td>
                <td className="tnum px-4 py-2 text-ink-700">{money(d.revenueMinor, currency)}</td>
                <td className="tnum px-4 py-2 text-ink-500">{d.cancelled || "—"}</td>
              </tr>
            ))}
            {r.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-400">Nothing was booked in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Room-type & Rate-plan performance (spec §3.2): nights, revenue, ADR per product. */
async function ProductsReport({ range, lens }: { range: ReturnType<typeof resolveRange>; lens: "stay" | "book" }) {
  const r = await getProductPerformance(range, lens);
  const currency = r.property.baseCurrency;
  const table = (title: string, rows: typeof r.roomTypes) => (
    <Card>
      <CardHeader title={title} />
      <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {["Product", "Reservations", "Room-nights", "Revenue", "ADR"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-surface-border/60 last:border-0">
              <td className="px-4 py-2.5 font-semibold text-ink-900">{row.name}</td>
              <td className="tnum px-4 py-2.5 text-ink-700">{row.reservations}</td>
              <td className="tnum px-4 py-2.5 text-ink-700">{row.nights}</td>
              <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{money(row.revenueMinor, currency)}</td>
              <td className="tnum px-4 py-2.5 text-ink-600">{row.adrMinor > 0 ? money(row.adrMinor, currency) : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-ink-400">No sold nights in this range.</td></tr>}
        </tbody>
      </table>
      </div>
    </Card>
  );
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {table(`By room type · ${range.label} · ${lens === "book" ? "booked in range" : "stays in range"}`, r.roomTypes)}
      {table(`By rate plan · ${range.label} · ${lens === "book" ? "booked in range" : "stays in range"}`, r.ratePlans)}
    </div>
  );
}

/** On-the-books (spec §3.2): committed FUTURE performance — confirmed reservations only,
 * honestly labelled (the future has no realized occupancy; this is not a prediction). */
async function OtbReport({ todayIso }: { todayIso: string }) {
  const { getForecast } = await import("@/lib/metrics");
  const [f7, f30] = await Promise.all([getForecast(todayIso, 7), getForecast(todayIso, 30)]);
  const property = await getProperty();
  const currency = property.baseCurrency;
  const block = (f: typeof f7) => (
    <Card className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Next {f.days} days — on the books</div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div><div className="tnum text-[24px] font-bold text-ink-900">{pct(f.occupancyPct)}</div><div className="text-[11.5px] text-ink-400">committed occupancy</div></div>
        <div><div className="tnum text-[24px] font-bold text-ink-900">{money(f.revenueMinor, currency)}</div><div className="text-[11.5px] text-ink-400">revenue on the books</div></div>
        <div><div className="tnum text-[20px] font-bold text-ink-800">{f.roomsSoldNights}</div><div className="text-[11.5px] text-ink-400">room-nights committed</div></div>
        <div><div className="tnum text-[20px] font-bold text-ink-800">{f.arrivals} / {f.departures}</div><div className="text-[11.5px] text-ink-400">arrivals / departures</div></div>
      </div>
    </Card>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-2">{block(f7)}{block(f30)}</div>
      <p className="text-[12px] text-ink-400">
        Expected values from confirmed bookings — not a prediction model. New pickup raises these; cancellations lower them.
      </p>
    </div>
  );
}

async function PickupReport() {
  const r = await getPickupReport();
  return (
    <Card>
      <CardHeader title={`Pickup & Pace · next 30 days · ${r.vsDate ? `vs the ${r.vsDate} snapshot` : "first snapshot recorded today — pace appears as history accumulates"}`} />
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Stay date", "Sold now", "Sold at snapshot", "Pickup"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.date} className="border-b border-surface-border/60 last:border-0">
                <td className="tnum px-4 py-2 text-ink-700">{row.date}</td>
                <td className="tnum px-4 py-2 font-semibold text-ink-900">{row.soldNow}</td>
                <td className="tnum px-4 py-2 text-ink-600">{row.soldAtSnap}</td>
                <td className={`tnum px-4 py-2 font-bold ${row.pickup > 0 ? "text-success-600" : row.pickup < 0 ? "text-danger-600" : "text-ink-400"}`}>
                  {row.pickup > 0 ? `+${row.pickup}` : row.pickup}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function SourceReport({ range }: { range: ReturnType<typeof resolveRange> }) {
  const m = await getRangeMetrics(range);
  const currency = m.property.baseCurrency;
  const e = m.economics;

  return (
    <div className="space-y-4">
      {/* K8 — what distribution costs. Two numbers of different KINDS sit on this screen, and the
          design's whole job is to keep them apart: commission paid is money that left, commission
          avoided is a counterfactual. Merging them into one "you saved" headline is the thing that
          makes booking-engine marketing untrustworthy, and this product's argument is that its
          numbers are real. So the estimate is visually quieter and carries its assumption inline. */}
      <Card>
        <CardHeader title={`Cost of distribution · ${range.label}`} />
        <div className="grid grid-cols-1 gap-px bg-surface-border sm:grid-cols-3">
          <div className="bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Commission paid</div>
            <div className="tnum mt-1 text-[1.6rem] font-bold leading-none text-ink-900">
              {money(e.commissionPaidMinor, currency)}
            </div>
            {/* Three states, not two (§2.5). "No blended rate" has two causes that mean opposite
                things: no OTA business at all, or OTA business whose channel has no rate set. The
                card used to print the first message in both cases — asserting distribution was free
                directly above a row reading "OTA · €780 · commission not set". */}
            <div className="mt-1.5 text-[12px] text-ink-500">
              {e.otaRevenueMinor === 0 ? (
                "no OTA revenue in this period"
              ) : e.commissionIncomplete ? (
                <span className="font-medium text-warning-600">
                  {money(e.unratedOtaRevenueMinor, currency)} OTA revenue · commission rate not set
                </span>
              ) : (
                `${pct(e.blendedOtaRatePct!)} of ${money(e.otaRevenueMinor, currency)} OTA revenue`
              )}
            </div>
          </div>

          <div className="bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Booked direct</div>
            <div className="tnum mt-1 text-[1.6rem] font-bold leading-none text-ink-900">
              {pct(e.directSharePct)}
            </div>
            <div className="mt-1.5 text-[12px] text-ink-500">
              {money(e.directRevenueMinor, currency)} of {money(e.totalRevenueMinor, currency)} · no commission
            </div>
          </div>

          <div className="bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Commission avoided <span className="font-normal normal-case text-ink-400">· estimate</span>
            </div>
            <div className="tnum mt-1 text-[1.6rem] font-bold leading-none text-ink-700">
              {e.commissionAvoidedMinor == null ? "—" : money(e.commissionAvoidedMinor, currency)}
            </div>
            <div className="mt-1.5 text-[12px] text-ink-500">
              {e.commissionAvoidedMinor != null
                ? `if direct bookings had come through your channels at ${pct(e.blendedOtaRatePct!)}`
                : e.otaRevenueMinor > 0
                  ? "set a commission rate on your channels and this becomes computable"
                  : "needs OTA revenue in the period to have a rate to compare against"}
            </div>
          </div>
        </div>
        <div className="border-t border-surface-border bg-surface-muted/40 px-4 py-2.5 text-[12px] text-ink-500">
          <span className="font-semibold text-ink-600">Commission paid is actual</span> — your channels&rsquo; own
          rates applied to the revenue they brought. <span className="font-semibold text-ink-600">Commission
          avoided is an estimate</span>: it assumes those direct guests would otherwise have booked through an
          OTA, which some would and some would not.{" "}
          {e.commissionIncomplete ? (
            // Suppressed on purpose. With an unset rate this figure silently treats real commission
            // as zero, which reports distribution as free — the one thing this card exists not to do.
            <span className="font-medium text-warning-600">
              Revenue kept is not shown: {money(e.unratedOtaRevenueMinor, currency)} of OTA revenue has no
              commission rate configured, so the real cost is unknown.
            </span>
          ) : (
            <>
              Revenue kept after real commission:{" "}
              <span className="tnum font-semibold text-ink-700">{money(e.netOfCommissionMinor, currency)}</span>.
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Source mix · ${range.label}`} />
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Source", "Reservations", "Room-nights", "Revenue", "Share", "Commission"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {e.rows.map((s) => (
              <tr key={s.sourceName} className="border-b border-surface-border/60 last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink-900">{s.sourceName}</td>
                <td className="tnum px-4 py-2.5 text-ink-700">{s.reservations}</td>
                <td className="tnum px-4 py-2.5 text-ink-700">{s.roomNights}</td>
                <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{money(s.revenueMinor, currency)}</td>
                <td className="tnum px-4 py-2.5 text-ink-700">{pct(s.sharePct)}</td>
                <td className="tnum px-4 py-2.5 text-ink-700">
                  {/* Classify by CATEGORY, never by the computed amount. A commissioned channel that
                      earned nothing this period also computes to zero, and rendering that as "none"
                      tells the hotel an OTA is free — the one claim this screen must never make. */}
                  {isCommissionFreeCategory(s.category) ? (
                    <span className="font-semibold text-success-600">none</span>
                  ) : s.commissionMinor == null ? (
                    <span className="text-ink-400" title="No commission rate configured for this channel">not set</span>
                  ) : (
                    <>
                      {money(s.commissionMinor, currency)}
                      <span className="ml-1 text-ink-400">({s.commissionPct}%)</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

/**
 * Cancellations (§2.2, §2.6) — a visual, with the denominator stated.
 *
 * Two changes from the table this replaces. It now honours the Stay/Book lens like every other tab
 * (it silently computed on book-date while displaying stay-date chips), and it says which
 * denominator it used in words, because "1 of 8" invites the reader to supply the wrong one.
 *
 * The reservation-level list has left Analytics entirely, per the §2.0 mandate. "Which specific
 * bookings cancelled" is a record question and Reservations already answers it —
 * `status = cancelled` is an existing filter — so the link goes there rather than duplicating a
 * table that would drift out of step with the real one.
 */
async function CancellationReport({ range, lens }: { range: ReturnType<typeof resolveRange>; lens: "stay" | "book" }) {
  const r = await getCancellationReport(range, lens);

  // Cancellations by source: the driver worth seeing. An OTA cancelling twice as often as direct is
  // a distribution decision; the same rate everywhere is just seasonality.
  const bySource = new Map<string, number>();
  for (const res of r.cancelled) {
    const name = res.channel?.name ?? res.bookingSource?.name ?? "Direct";
    bySource.set(name, (bySource.get(name) ?? 0) + 1);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const worstSource = Math.max(1, ...sources.map(([, n]) => n));

  // The gauge reads on a 0–30% scale: above that is a crisis, and a 0–100% arc renders every real
  // hotel as a barely-visible sliver.
  const gaugePct = Math.min(100, (r.headlineRatePct / 30) * 100);
  const tone = r.headlineRatePct >= 20 ? "text-danger-600" : r.headlineRatePct >= 10 ? "text-warning-600" : "text-success-600";
  const bar = r.headlineRatePct >= 20 ? "bg-danger-500" : r.headlineRatePct >= 10 ? "bg-warning-500" : "bg-success-500";

  return (
    <Card>
      <CardHeader
        title={`Cancellations · ${range.label}`}
        subtitle={`Counted ${lens === "book" ? "by booking date" : "by stay date"} — ${r.basisLabel}`}
      />
      <div className="grid gap-6 px-4 py-5 md:grid-cols-2">
        {/* Both framings, side by side. The headline rate and the room-night rate answer different
            questions and a hotel that shows only one is usually showing the flattering one. */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`tnum text-[2.4rem] font-bold leading-none ${tone}`}>{pct(r.headlineRatePct)}</span>
            <span className="text-[12.5px] text-ink-500">of reservations</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunken" role="img"
               aria-label={`Cancellation rate ${pct(r.headlineRatePct)} of reservations`}>
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${gaugePct}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-400">
            {r.cancelled.length} of {r.createdCount} · scale ends at 30%
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="tnum text-[1.5rem] font-bold leading-none text-ink-900">{pct(r.roomNightRatePct)}</span>
            <span className="text-[12.5px] text-ink-500">of room-nights</span>
          </div>
          <p className="mt-1 text-[11.5px] text-ink-400">
            {r.cancelledNights} of {r.grossNights} nights — the number that matters for revenue
          </p>
        </div>

        {/* Drivers. */}
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">By source</h4>
          {sources.length === 0 ? (
            <p className="text-[13px] text-ink-500">No cancellations in this period.</p>
          ) : (
            <ul className="space-y-1.5">
              {sources.map(([name, n]) => (
                <li key={name} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-28 shrink-0 truncate text-ink-600">{name}</span>
                  <span className="h-3 rounded-sm bg-danger-500/70" style={{ width: `${(n / worstSource) * 100}%`, minWidth: "0.5rem" }} />
                  <span className="tnum text-ink-700">{n}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
            Which bookings cancelled is a list, so it lives where lists live —{" "}
            <Link href="/reservations?status=cancelled" className="font-semibold text-brand-700 hover:underline">
              Reservations, filtered to cancelled
            </Link>
            . Export CSV here carries the full detail.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Availability heatmap (§2.2, §2.3) — the biggest single visual upgrade in the module.
 *
 * The same room-type × day matrix, but each cell is coloured by remaining as a **share of that room
 * type's capacity**, with the count kept as the label. A labelled cell is still a visual and still
 * fully reconcilable, which is what the §2.0 mandate requires — the colour answers "where is it
 * tight" at a glance, and the number is still there to defend.
 *
 * The scale is `availabilityPressure`, shared with the Inventory Calendar so the same day cannot
 * read differently on two screens. It replaces `remaining <= 2`, which called two-of-three suites
 * urgent and three-of-forty rooms comfortable.
 *
 * The header states the actual date range rather than "next 30 days". §2.7 reported a column count
 * that disagreed with the header; the data is right (30 dates), so the ambiguity was the header
 * asserting a number the reader then had to verify by counting. A stated range is self-checking.
 */
async function AvailabilityReport() {
  const board = await getInventoryBoard({ days: 30 });
  const first = board.dates[0];
  const last = board.dates[board.dates.length - 1];
  const dayLabel = (iso: string) => Number(iso.slice(8, 10));

  const TONE: Record<string, string> = {
    overbooked: "bg-danger-500 text-white",
    soldout: "bg-danger-100 text-danger-700",
    low: "bg-warning-100 text-warning-700",
    open: "bg-success-50 text-ink-600",
  };

  return (
    <Card>
      <CardHeader
        title={`Availability · ${first} → ${last} · remaining per room type`}
        subtitle="Shaded by how much of each room type is still sellable — not by an absolute count"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="sticky left-0 z-10 bg-white px-4 py-2.5">Room type</th>
              {board.dates.map((d) => <th key={d} className="tnum min-w-[34px] px-1 py-2.5 text-center">{dayLabel(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {board.sections.map((s) => {
              const capacity = s.roomType.totalRooms;
              return (
                <tr key={s.roomType.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-semibold text-ink-900">
                    {s.roomType.name}
                    <span className="ml-1.5 text-[10.5px] font-normal text-ink-400">{capacity} rooms</span>
                  </td>
                  {s.cells.map((cell, i) => {
                    const pressure = availabilityPressure(cell.remaining, capacity);
                    return (
                      <td key={i} className="px-0.5 py-1 text-center">
                        <span
                          className={`tnum inline-block min-w-[26px] rounded px-1 py-0.5 text-[11.5px] font-semibold ${TONE[pressure]}`}
                          title={`${board.dates[i]} · ${cell.remaining} of ${capacity} remaining`}
                        >
                          {cell.remaining}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
        <StatusPill tone="danger">overbooked</StatusPill> <StatusPill tone="warning">under {Math.round(LOW_AVAILABILITY_SHARE * 100)}% left</StatusPill>{" "}
        — relative to each room type, so a small type is not flagged for having two of three free.
        Day-by-day detail is on the Inventory Calendar.
      </p>
    </Card>
  );
}
