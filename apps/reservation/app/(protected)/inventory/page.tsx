import Link from "next/link";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { getInventoryBoard, addDays, ymd } from "@/lib/data";
import { ensurePickupSnapshot } from "@/lib/pickup";
import { PageHeader } from "@/components/ui/primitives";
import { RateCell } from "@/components/inventory/RateCell";

export const dynamic = "force-dynamic";

/** Row order per room type — straight from the waterfall (docs/CRS-REFERENCE.md "Inventory Calendar"). */
const ROWS = [
  { key: "physical", label: "Physical" },
  { key: "outOfOrder", label: "Out of order" },
  { key: "closed", label: "Closed" },
  { key: "available", label: "Available" },
  { key: "confirmed", label: "Sold" },
  { key: "remaining", label: "Remaining" },
] as const;

function remainingTone(remaining: number, available: number): string {
  if (remaining < 0) return "bg-danger-500 text-white";
  if (remaining === 0) return "bg-danger-50 text-danger-600";
  if (remaining <= 2 || (available > 0 && remaining / available <= 0.2)) return "bg-warning-50 text-warning-600";
  return "text-success-600";
}

export default async function InventoryCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const board = await getInventoryBoard({ start: sp.start, days: sp.days ? Number(sp.days) : undefined });
  await ensurePickupSnapshot();

  const startDate = new Date(`${board.start}T00:00:00Z`);
  const prev = ymd(addDays(startDate, -board.days));
  const next = ymd(addDays(startDate, board.days));
  const navCls =
    "flex h-8 items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted";

  return (
    <div>
      <PageHeader
        title="Inventory Calendar"
        subtitle={`${board.property.name} · every number below comes from the availability waterfall`}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/inventory?start=${prev}&days=${board.days}`} className={navCls} aria-label="Earlier"><ChevronLeft className="h-4 w-4" /></Link>
            <Link href="/inventory" className={navCls}>Today</Link>
            <Link href={`/inventory?start=${next}&days=${board.days}`} className={navCls} aria-label="Later"><ChevronRight className="h-4 w-4" /></Link>
            <Link href="/setup" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Wrench className="h-3.5 w-3.5" /> Manage periods
            </Link>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-white shadow-card">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted/60">
              <th className="sticky left-0 z-10 min-w-[168px] bg-surface-muted/60 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400 backdrop-blur">
                Room type
              </th>
              {board.dates.map((d) => {
                const date = new Date(`${d}T00:00:00Z`);
                const isToday = d === board.todayIso;
                const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                return (
                  <th key={d} className={`min-w-[64px] px-2 py-2.5 text-center ${weekend ? "bg-warning-50/40" : ""}`}>
                    <div className={`text-[10px] font-semibold uppercase ${isToday ? "text-brand-700" : "text-ink-400"}`}>
                      {date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                    </div>
                    <div className={`tnum text-[12.5px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>
                      {Number(d.slice(8, 10))}<span className="ml-0.5 text-[10px] font-medium text-ink-400">{date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {board.sections.map((section) => (
              <SectionRows key={section.roomType.id} section={section} dates={board.dates} todayIso={board.todayIso} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px] text-ink-400">
        Available = physical − out&nbsp;of&nbsp;order − closed (a <span className="font-semibold text-brand-700">•</span> marks a manual rooms-to-sell
        override from RevioLink) · Remaining = available − holds − sold. Negative remaining = overbooked. Rate = the
        standard plan, click to edit. Restrictions resolve manual&nbsp;→&nbsp;rule&nbsp;→&nbsp;plan&nbsp;→&nbsp;property default
        (<span className="inline-block h-2 w-2 rounded-full bg-danger-500 align-middle" /> stop&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-brand-600 align-middle" /> CTA&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-accent-500 align-middle" /> CTD).
      </p>
    </div>
  );
}

function SectionRows({
  section, dates, todayIso,
}: {
  section: Awaited<ReturnType<typeof getInventoryBoard>>["sections"][number];
  dates: string[];
  todayIso: string;
}) {
  return (
    <>
      <tr className="border-b border-surface-border/60 bg-brand-50/50">
        <td colSpan={dates.length + 1} className="sticky left-0 px-4 py-1.5 text-[12px] font-bold text-brand-800">
          {section.roomType.name} <span className="ml-1 font-medium text-ink-400">{section.roomType.code} · {section.roomType.totalRooms} {section.roomType.unitKind === "bed" ? "beds" : "rooms"}</span>
        </td>
      </tr>
      {ROWS.map((row) => (
        <tr key={row.key} className="border-b border-surface-border/40">
          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium text-ink-500">{row.label}</td>
          {section.cells.map((cell, i) => {
            const value = cell[row.key];
            const isToday = dates[i] === todayIso;
            let cls = "text-ink-700";
            if (row.key === "outOfOrder" || row.key === "closed") cls = value > 0 ? "font-bold text-warning-600" : "text-ink-300";
            if (row.key === "confirmed") cls = value > 0 ? "font-semibold text-ink-700" : "text-ink-300";
            if (row.key === "available") cls = "font-semibold text-ink-700";
            if (row.key === "remaining") cls = `rounded font-bold ${remainingTone(cell.remaining, cell.available)}`;
            return (
              <td key={i} className={`px-2 py-1.5 text-center ${isToday ? "bg-brand-50/40" : ""}`}>
                <span className={`tnum inline-block min-w-[26px] px-1 text-[12px] ${cls}`}>
                  {value}
                  {row.key === "available" && cell.manualOverride && (
                    <span title="Manual rooms-to-sell override (set in RevioLink)" className="ml-0.5 align-top text-[10px] font-bold text-brand-700">•</span>
                  )}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
      {/* Rate (editable, standard plan) + resolved Restrictions — the spec's last two calendar rows. */}
      <tr className="border-b border-surface-border/40">
        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium text-ink-500">Rate</td>
        {section.cells.map((cell, i) => (
          <td key={i} className={`px-1 py-1 text-center ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
            <RateCell roomTypeId={section.roomType.id} date={dates[i]!} value={cell.rate} />
          </td>
        ))}
      </tr>
      <tr className="border-b border-surface-border/40 last:border-b-surface-border">
        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium text-ink-500">Restrictions</td>
        {section.cells.map((cell, i) => (
          <td key={i} className={`px-1 py-1 text-center ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
            <span className="inline-flex items-center justify-center gap-1">
              {cell.restr.minLos != null && cell.restr.minLos > 1 && (
                <span title={`Min stay ${cell.restr.minLos} nights`} className="rounded bg-brand-50 px-1 text-[9.5px] font-bold text-brand-700">{cell.restr.minLos}n</span>
              )}
              {cell.restr.stopSell && <span title="Stop sell" className="inline-block h-2 w-2 rounded-full bg-danger-500" />}
              {cell.restr.cta && <span title="Closed to arrival" className="inline-block h-2 w-2 rounded-full bg-brand-600" />}
              {cell.restr.ctd && <span title="Closed to departure" className="inline-block h-2 w-2 rounded-full bg-accent-500" />}
              {!cell.restr.stopSell && !cell.restr.cta && !cell.restr.ctd && (cell.restr.minLos ?? 1) <= 1 && (
                <span className="text-ink-200">·</span>
              )}
            </span>
          </td>
        ))}
      </tr>
    </>
  );
}
