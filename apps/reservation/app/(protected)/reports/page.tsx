import Link from "next/link";
import { Download } from "lucide-react";
import { getInventoryBoard } from "@/lib/data";
import { getCancellationReport, getPickupReport, getRangeMetrics, resolveRange, type RangePreset } from "@/lib/metrics";
import { getProperty, todayInTz } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const REPORTS = [
  { key: "performance", label: "Performance" },
  { key: "pickup", label: "Pickup & Pace" },
  { key: "source", label: "Source" },
  { key: "cancellation", label: "Cancellation" },
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
  searchParams: Promise<{ report?: string; range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const report = REPORTS.some((r) => r.key === sp.report) ? sp.report! : "performance";
  const property = await getProperty();
  const todayIso = todayInTz(property.timezone);
  const range = resolveRange(todayIso, sp.range ?? "30d", sp.from, sp.to);
  const qs = `report=${report}&range=${range.preset}${range.preset === "custom" ? `&from=${sp.from}&to=${sp.to}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        subtitle={`${property.name} · calculated from reservations + inventory — never stored separately`}
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
            href={`/reports?report=${r.key}&range=${range.preset}`}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              report === r.key ? "bg-brand-800 text-white" : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {r.label}
          </Link>
        ))}
        {(report === "performance" || report === "source" || report === "cancellation") && (
          <span className="ml-2 flex items-center gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/reports?report=${report}&range=${r.key}`}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  range.preset === r.key ? "bg-brand-50 text-brand-800 ring-1 ring-brand-600/30" : "text-ink-500 hover:bg-surface-muted"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </span>
        )}
      </div>

      {report === "performance" && <PerformanceReport range={range} />}
      {report === "pickup" && <PickupReport />}
      {report === "source" && <SourceReport range={range} />}
      {report === "cancellation" && <CancellationReport range={range} />}
      {report === "availability" && <AvailabilityReport />}
    </div>
  );
}

async function PerformanceReport({ range }: { range: ReturnType<typeof resolveRange> }) {
  const m = await getRangeMetrics(range);
  const currency = m.property.baseCurrency;
  return (
    <Card>
      <CardHeader title={`Performance · ${range.label} · totals: ${pct(m.cards.occupancyPct)} occupancy · ${money(m.cards.revenueMinor, currency)} revenue (${m.cards.revenueDisplay}) · ADR ${money(m.cards.adrMinor, currency)} · RevPAR ${money(m.cards.revparMinor, currency)}`} />
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Date", "Available", "Sold", "Occupancy", "Revenue", "ADR", "RevPAR"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {m.perDay.map((d) => (
              <tr key={d.date} className="border-b border-surface-border/60 last:border-0">
                <td className="tnum px-4 py-2 text-ink-700">{d.date}</td>
                <td className="tnum px-4 py-2 text-ink-600">{d.available}</td>
                <td className="tnum px-4 py-2 font-semibold text-ink-900">{d.soldNights}</td>
                <td className="tnum px-4 py-2 text-ink-700">{pct(d.occupancyPct)}</td>
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
