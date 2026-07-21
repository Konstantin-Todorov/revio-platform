import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { getInventoryBoard, addDays, ymd } from "@/lib/data";
import { ensurePickupSnapshot } from "@/lib/pickup";
import { PageHeader } from "@/components/ui/primitives";
import { RateCell } from "@/components/inventory/RateCell";
import { CollapseAll } from "@/components/inventory/CollapseAll";
import { ParamMultiSelect } from "@/components/inventory/ParamMultiSelect";
import { CrsCalendarBulkButton } from "@/components/inventory/CrsCalendarBulkButton";
import { deriveRate, type DerivedRateConfig } from "@revio/core";

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
  searchParams: Promise<{ start?: string; days?: string; rp?: string; rt?: string }>;
}) {
  const sp = await searchParams;
  const board = await getInventoryBoard({ start: sp.start, days: sp.days ? Number(sp.days) : undefined });
  await ensurePickupSnapshot();

  // Room-type view filter (§5.1, match RevioLink) — narrows which room-type sections render.
  const rt = (sp.rt ?? "").split(",").filter(Boolean);
  const sections = rt.length > 0 ? board.sections.filter((s) => rt.includes(s.roomType.code)) : board.sections;
  // Data for the in-calendar bulk modal (§5.2) — same room types + rate plans the Bulk screen uses.
  const bulkRoomTypes = board.sections.map((s) => ({ id: s.roomType.id, name: s.roomType.name }));
  const bulkPlans = await prisma.ratePlan.findMany({
    where: { propertyId: board.property.id, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, priceLogic: true, parent: { select: { name: true } } },
  });
  const bulkPlanOpts = bulkPlans.map((p) => ({ id: p.id, name: p.name, priceLogic: p.priceLogic, parentName: p.parent?.name ?? null }));

  // Rate-plan multi-select (spec §3.5, aligned to RevioLink): governs RATE rows only — the
  // waterfall and restriction rows stay pinned regardless. Default = the standard plan.
  const rp = (sp.rp ?? "").split(",").filter(Boolean);
  const allPlans = await prisma.ratePlan.findMany({
    where: { propertyId: board.property.id, active: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, priceLogic: true, derivedType: true, derivedDirection: true, derivedValue: true, derivedRounding: true, derivedFloorMinor: true, derivedCeilingMinor: true },
  });
  const standardCode = allPlans.find((p) => p.priceLogic === "manual")?.code ?? "BAR";
  const selected = new Set(rp.length > 0 ? rp : [standardCode]);
  const derivedRows = allPlans
    .filter((p) => p.priceLogic === "derived" && selected.has(p.code))
    .map((p) => ({
      code: p.code,
      name: p.name,
      offset: p.derivedType === "percent" ? `${p.derivedDirection === "increase" ? "+" : "−"}${p.derivedValue}%` : `${p.derivedDirection === "increase" ? "+" : "−"}€${((p.derivedValue ?? 0) / 100).toLocaleString("en-US")}`,
      cfg: {
        parentRatePlanId: "",
        adjustmentType: (p.derivedType as "percent" | "fixed") ?? "percent",
        direction: (p.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: p.derivedValue ?? 0,
        rounding: (p.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
        ...(p.derivedFloorMinor != null ? { floorMinor: p.derivedFloorMinor } : {}),
        ...(p.derivedCeilingMinor != null ? { ceilingMinor: p.derivedCeilingMinor } : {}),
      } satisfies DerivedRateConfig,
    }));
  const showStandardRate = selected.has(standardCode);

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
            <Link href="/rooms-rates" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Wrench className="h-3.5 w-3.5" /> Manage periods
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ParamMultiSelect
          label="Rooms" param="rt" emptyLabel="All"
          options={board.sections.map((s) => ({ value: s.roomType.code, label: s.roomType.name }))}
          selected={rt}
        />
        <ParamMultiSelect
          label="Rates" param="rp" emptyLabel="Standard only"
          options={allPlans.map((p) => ({ value: p.code, label: p.priceLogic === "derived" ? `${p.name} (derived)` : p.name }))}
          selected={[...selected]}
        />
        <CollapseAll containerId="crs-inventory-sections" />
      </div>

      <div id="crs-inventory-sections" className="space-y-3">
        {sections.map((section) => (
          <details key={section.roomType.id} open className="group/section overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <summary className="flex cursor-pointer select-none items-center gap-3 border-b border-surface-border bg-surface-muted/60 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400 transition-transform group-open/section:rotate-0" />
              <span className="text-[13.5px] font-bold text-ink-900">{section.roomType.name}</span>
              <span className="text-[11px] font-medium text-ink-400">
                {section.roomType.code} · {section.roomType.totalRooms} {section.roomType.unitKind === "bed" ? "beds" : "rooms"}
              </span>
              {/* Inline per-row bulk (§5.2): opens the bulk tool in a modal OVER the calendar,
                  pre-scoped to this room type — the SAME engine + audit path as the Bulk screen. */}
              <CrsCalendarBulkButton
                roomTypeId={section.roomType.id}
                roomTypeName={section.roomType.name}
                roomTypes={bulkRoomTypes}
                ratePlans={bulkPlanOpts}
                today={board.todayIso}
              />
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="sticky left-0 z-10 min-w-[168px] bg-white px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400" />
                    {board.dates.map((d) => {
                      const date = new Date(`${d}T00:00:00Z`);
                      const isToday = d === board.todayIso;
                      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                      return (
                        <th key={d} className={`min-w-[64px] px-2 py-1.5 text-center ${weekend ? "bg-warning-50/40" : ""}`}>
                          <div className={`text-[10px] font-semibold uppercase ${isToday ? "text-brand-700" : "text-ink-400"}`}>
                            {date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                          </div>
                          <div className={`tnum text-[12px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>
                            {Number(d.slice(8, 10))}<span className="ml-0.5 text-[10px] font-medium text-ink-400">{date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <SectionRows section={section} dates={board.dates} todayIso={board.todayIso} showStandardRate={showStandardRate} derivedRows={derivedRows} />
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-400">
        Available = physical − out&nbsp;of&nbsp;order − closed (a <span className="font-semibold text-brand-700">•</span> marks a manual rooms-to-sell
        override from RevioLink) · Remaining = available − holds − sold. Negative remaining = overbooked. Rate = the
        standard plan, click to edit. Restrictions resolve date-scoped edit (calendar/bulk, most recent wins)&nbsp;→&nbsp;rule&nbsp;→&nbsp;plan&nbsp;→&nbsp;property default
        (<span className="inline-block h-2 w-2 rounded-full bg-danger-500 align-middle" /> stop&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-brand-600 align-middle" /> CTA&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-accent-500 align-middle" /> CTD).
      </p>
    </div>
  );
}

type DerivedRow = { code: string; name: string; offset: string; cfg: DerivedRateConfig };

function SectionRows({
  section, dates, todayIso, showStandardRate, derivedRows,
}: {
  section: Awaited<ReturnType<typeof getInventoryBoard>>["sections"][number];
  dates: string[];
  todayIso: string;
  showStandardRate: boolean;
  derivedRows: DerivedRow[];
}) {
  return (
    <>
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
      {/* Rate rows (editable standard + read-only derived, per the multi-select) + Restrictions. */}
      {showStandardRate && (
        <tr className="border-b border-surface-border/40">
          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium text-ink-500">Rate</td>
          {section.cells.map((cell, i) => (
            <td key={i} className={`px-1 py-1 text-center ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
              <RateCell roomTypeId={section.roomType.id} date={dates[i]!} value={cell.rate} />
            </td>
          ))}
        </tr>
      )}
      {derivedRows.map((dr) => (
        <tr key={dr.code} className="border-b border-surface-border/40">
          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-4 text-[11.5px] font-medium text-ink-400">
            <span title={`Derived from the standard rate · ${dr.offset}`} className="mr-1 cursor-help select-none">📎</span>
            {dr.name} <span className="tnum rounded bg-surface-sunken px-1 text-[10px] font-semibold text-ink-500">{dr.offset}</span>
          </td>
          {section.cells.map((cell, i) => (
            <td key={i} className={`px-1 py-1 text-center text-ink-400 ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
              <span className="tnum text-[12px]">{cell.rate === "—" ? "—" : Math.round(deriveRate(Number(cell.rate) * 100, dr.cfg) / 100)}</span>
            </td>
          ))}
        </tr>
      ))}
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
