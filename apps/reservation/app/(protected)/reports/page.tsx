import Link from "next/link";
import { Download } from "lucide-react";
import { Layers } from "lucide-react";
import { getInventoryBoard } from "@/lib/data";
import { getCancellationReport, getPickupReport, getProductPerformance, getProductionByDay, getRangeMetrics, resolveRange, stlyRange, type RangePreset } from "@/lib/metrics";
import { getProperty, getScope, todayInTz } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money } from "@/lib/format";

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
  searchParams: Promise<{ report?: string; range?: string; from?: string; to?: string; lens?: string; g?: string }>;
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
  const qs = `report=${report}&range=${range.preset}${range.preset === "custom" ? `&from=${sp.from}&to=${sp.to}` : ""}&lens=${lens}`;
  const href = (over: Record<string, string>) => {
    const params = new URLSearchParams({ report, range: range.preset, lens, g: gran, ...over });
    if (range.preset === "custom") { if (sp.from) params.set("from", sp.from); if (sp.to) params.set("to", sp.to); }
    return `/reports?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        subtitle={`${isGroup ? scope.label : property.name} · calculated from reservations + inventory — never stored separately`}
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

      {report === "performance" && (lens === "book" ? <ProductionReport range={range} /> : <PerformanceReport range={range} gran={gran} />)}
      {report === "pickup" && <PickupReport />}
      {report === "source" && <SourceReport range={range} />}
      {report === "products" && <ProductsReport range={range} lens={lens} />}
      {report === "cancellation" && <CancellationReport range={range} />}
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

async function PerformanceReport({ range, gran }: { range: ReturnType<typeof resolveRange>; gran: "d" | "w" | "m" }) {
  const [m, s] = await Promise.all([getRangeMetrics(range), getRangeMetrics(stlyRange(range))]);
  const currency = m.property.baseCurrency;
  const rows = bucket(m.perDay, gran);
  // YoY vs STLY (364 days back — same weekday), green/red per spec §4.2.
  const yoy = (now: number, then: number, fmt: (v: number) => string) =>
    then > 0 ? (
      <span className={now >= then ? "text-success-600" : "text-danger-600"}>
        {now >= then ? "▲" : "▼"} {fmt(Math.abs(now - then))} vs STLY
      </span>
    ) : null;
  return (
    <Card>
      <CardHeader
        title={`Performance · ${range.label} · ${pct(m.cards.occupancyPct)} occupancy · ${money(m.cards.revenueMinor, currency)} revenue (${m.cards.revenueDisplay}) · ADR ${money(m.cards.adrMinor, currency)} · RevPAR ${money(m.cards.revparMinor, currency)}`}
      />
      <div className="flex flex-wrap gap-4 border-b border-surface-border/60 px-4 py-2 text-[12px]">
        <span className="text-ink-400">Same time last year (364d back):</span>
        {yoy(m.cards.occupancyPct, s.cards.occupancyPct, (v) => `${v.toFixed(1)}pp occupancy`)}
        {yoy(m.cards.revenueMinor, s.cards.revenueMinor, (v) => `${money(v, currency)} revenue`)}
        {yoy(m.cards.adrMinor, s.cards.adrMinor, (v) => `${money(v, currency)} ADR`)}
        {s.cards.revenueMinor === 0 && <span className="text-ink-400">no STLY data yet</span>}
      </div>
      <div className="max-h-[520px] overflow-auto">
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
    </Card>
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
  return (
    <Card>
      <CardHeader title={`Source mix · ${range.label}`} />
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {["Source", "Reservations", "Room-nights", "Revenue", "Share"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {m.sourceMix.map((s) => (
            <tr key={s.name} className="border-b border-surface-border/60 last:border-0">
              <td className="px-4 py-2.5 font-semibold text-ink-900">{s.name}</td>
              <td className="tnum px-4 py-2.5 text-ink-700">{s.reservations}</td>
              <td className="tnum px-4 py-2.5 text-ink-700">{s.roomNights}</td>
              <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{money(s.revenueMinor, currency)}</td>
              <td className="tnum px-4 py-2.5 text-ink-700">{pct(s.sharePct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function CancellationReport({ range }: { range: ReturnType<typeof resolveRange> }) {
  const r = await getCancellationReport(range);
  return (
    <Card>
      <CardHeader title={`Cancellations · ${range.label} · headline ${pct(r.headlineRatePct)} (${r.cancelled.length} of ${r.createdCount} created) · room-night rate ${pct(r.roomNightRatePct)} (${r.cancelledNights} of ${r.grossNights})`} />
      {r.cancelled.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-ink-500">No cancellations among reservations created in this range.</div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Guest", "Stay", "Room", "Source", "Total", "Cancelled"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.cancelled.map((res) => {
              const line = res.lines[0];
              return (
                <tr key={res.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5"><Link href={`/reservations/${res.id}`} className="font-semibold text-brand-700 hover:underline">{res.guestName}</Link></td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{line ? `${line.checkIn.toISOString().slice(0, 10)} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}</td>
                  <td className="px-4 py-2.5 text-ink-600">{line?.roomType.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-600">{res.channel?.name ?? res.bookingSource?.name ?? "Direct"}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{money(res.totalMinor, res.currency)}</td>
                  <td className="tnum px-4 py-2.5 text-ink-500">{res.cancelledAt ? res.cancelledAt.toISOString().slice(0, 10) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

async function AvailabilityReport() {
  const board = await getInventoryBoard({ days: 30 });
  return (
    <Card>
      <CardHeader title="Availability · next 30 days · remaining per room type" />
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="sticky left-0 bg-white px-4 py-2.5">Room type</th>
              {board.dates.map((d) => <th key={d} className="tnum min-w-[36px] px-1 py-2.5 text-center">{Number(d.slice(8, 10))}</th>)}
            </tr>
          </thead>
          <tbody>
            {board.sections.map((s) => (
              <tr key={s.roomType.id} className="border-b border-surface-border/60 last:border-0">
                <td className="sticky left-0 bg-white px-4 py-2 font-semibold text-ink-900">{s.roomType.name}</td>
                {s.cells.map((cell, i) => (
                  <td key={i} className="px-1 py-2 text-center">
                    <span className={`tnum inline-block min-w-[22px] rounded px-0.5 text-[11.5px] font-semibold ${
                      cell.remaining < 0 ? "bg-danger-500 text-white" : cell.remaining === 0 ? "bg-danger-50 text-danger-600" : cell.remaining <= 2 ? "bg-warning-50 text-warning-600" : "text-ink-600"
                    }`}>
                      {cell.remaining}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
        <StatusPill tone="danger">overbooked</StatusPill> <StatusPill tone="warning">low</StatusPill> — full waterfall detail on the Inventory Calendar.
      </p>
    </Card>
  );
}
