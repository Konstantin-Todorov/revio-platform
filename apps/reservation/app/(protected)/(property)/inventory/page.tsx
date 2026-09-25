import Link from "next/link";
import { BedDouble, ChevronDown, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { type InventoryRatePlanRow, getInventoryBoard, addDays, ymd } from "@/lib/data";
import { ensurePickupSnapshot } from "@/lib/pickup";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { RateCell } from "@/components/inventory/RateCell";
import { OccupancyRatePopover } from "@/components/inventory/OccupancyRatePopover";
import { CollapseAll } from "@/components/inventory/CollapseAll";
import { ParamMultiSelect } from "@/components/inventory/ParamMultiSelect";
import { CrsCalendarBulkButton } from "@/components/inventory/CrsCalendarBulkButton";
import { availabilityPressure } from "@revio/core";
import { LOCALE_LABELS } from "@revio/ui/i18n";
import { i18n } from "@/lib/i18n/server";
import { inventory as inventoryDict, type InventoryStrings } from "@/lib/i18n/inventory";

export const dynamic = "force-dynamic";

/** Row order per room type — straight from the waterfall (docs/CRS-REFERENCE.md "Inventory Calendar"). */
/*
 * ⚠️ "Bookable", not "Remaining" — the same word RevioLink's calendar uses.
 *
 * The two products described the same number with two different words, which is how a hotelier
 * comparing the screens cannot tell whether they are looking at the same quantity (BUG-017, 13
 * Sept). One name for one fact, in both products.
 */
const ROWS = ["physical", "outOfOrder", "closed", "available", "confirmed", "remaining"] as const;

/**
 * Shade the Remaining row by pressure (§5.2), using the SAME rule as the Analytics heatmap.
 *
 * It carried its own copy — `remaining <= 2 || share <= 0.2` — and the absolute half is the bug §2.3
 * removed: two of three suites is 67% free and was flagged urgent, while three of forty rooms said
 * nothing. Two screens disagreeing about whether the same day is tight is its own bug, so the rule
 * now lives in one place and both read it.
 */
const TONE: Record<string, string> = {
  overbooked: "bg-danger-500 text-white",
  soldout: "bg-danger-50 text-danger-600",
  low: "bg-warning-50 text-warning-600",
  open: "text-success-600",
};

function remainingTone(remaining: number, available: number): string {
  return TONE[availabilityPressure(remaining, available)]!;
}

export default async function InventoryCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string; rp?: string; rt?: string }>;
}) {
  const sp = await searchParams;
  const { t, locale } = await i18n();
  const s = t(inventoryDict);
  const intl = locale === "en" ? "en-GB" : LOCALE_LABELS[locale].intl;
  /*
   * ⚠️ `rp` is passed to the QUERY now.
   *
   * The Rates filter used to be read here, used to compute which rows this page drew, and never
   * reached `getInventoryBoard` — so the board always returned one plan's prices whatever was
   * ticked, and the control could not change the grid. Reported as BUG-002: "the control is not
   * wired to the render".
   */
  const board = await getInventoryBoard({
    start: sp.start,
    days: sp.days ? Number(sp.days) : undefined,
    rp: (sp.rp ?? "").split(",").filter(Boolean),
  });
  await ensurePickupSnapshot();

  // Room-type view filter (§5.1, match RevioLink) — narrows which room-type sections render.
  const rt = (sp.rt ?? "").split(",").filter(Boolean);
  const sections = rt.length > 0 ? board.sections.filter((s) => rt.includes(s.roomType.code)) : board.sections;
  // Data for the in-calendar bulk modal (§5.2) — same room types + rate plans the Bulk screen uses.
  const bulkRoomTypes = board.sections.map((s) => ({ id: s.roomType.id, name: s.roomType.name, code: s.roomType.code }));
  const bulkPlans = await prisma.ratePlan.findMany({
    // Inactive plans included on purpose — the tree shows them greyed rather than hiding them
    // (§5.3 rule 4); `selectablePlans` in @revio/core is what stops them being ticked.
    where: { propertyId: board.property.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, code: true, priceLogic: true, active: true,
      parent: { select: { name: true } },
      roomTypeLinks: { select: { roomTypeId: true } },
    },
  });
  const bulkPlanOpts = bulkPlans.map((p) => ({
    id: p.id, name: p.name, code: p.code, priceLogic: p.priceLogic, active: p.active,
    parentName: p.parent?.name ?? null,
    roomTypeIds: p.roomTypeLinks.map((l) => l.roomTypeId),
  }));

  /*
   * The rate rows come from the BOARD, which computed them, the filter's options and the selected
   * set from one reconciliation. This page used to derive its own answer from the URL and the
   * database — a second opinion that disagreed with the data it was drawing.
   */
  const rateRows = board.ratePlanRows;

  const startDate = new Date(`${board.start}T00:00:00Z`);
  const prev = ymd(addDays(startDate, -board.days));
  const next = ymd(addDays(startDate, board.days));
  const navCls =
    "flex h-8 items-center gap-1 rounded-md border border-surface-border bg-white px-2.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted";

  // Nothing to draw a calendar of until the hotel has said what it sells.
  if (board.sections.length === 0) {
    return (
      <div>
        <PageHeader title={s.title} subtitle={board.property.name} />
        <EmptyState
          icon={<BedDouble className="h-6 w-6" />}
          title={s.emptyTitle}
          body={s.emptyBody}
          actionLabel={s.emptyAction}
          actionHref="/rooms-rates"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(board.property.name)}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/inventory?start=${prev}&days=${board.days}`} className={navCls} aria-label={s.earlier}><ChevronLeft className="h-4 w-4" /></Link>
            <Link href="/inventory" className={navCls}>{s.today}</Link>
            <Link href={`/inventory?start=${next}&days=${board.days}`} className={navCls} aria-label={s.later}><ChevronRight className="h-4 w-4" /></Link>
            <Link href="/rooms-rates" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Wrench className="h-3.5 w-3.5" /> {s.managePeriods}
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ParamMultiSelect
          label={s.filterRooms} param="rt" emptyLabel={s.allRooms}
          options={board.sections.map((s) => ({ value: s.roomType.code, label: s.roomType.name }))}
          selected={rt}
        />
        <ParamMultiSelect
          label={s.filterRates} param="rp" emptyLabel={s.allRatePlans}
          options={board.ratePlanOptions}
          selected={board.selectedRatePlans}
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
                {section.roomType.code} · {s.units(section.roomType.totalRooms, section.roomType.unitKind === "bed" ? "bed" : "room")}
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
                            {date.toLocaleDateString(intl, { weekday: "short", timeZone: "UTC" })}
                          </div>
                          <div className={`tnum text-[12px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>
                            {Number(d.slice(8, 10))}<span className="ml-0.5 text-[10px] font-medium text-ink-400">{locale === "en" ? date.toLocaleDateString(intl, { month: "short", timeZone: "UTC" }) : s.monthsShort[date.getUTCMonth()]}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <SectionRows section={section} dates={board.dates} todayIso={board.todayIso} rateRows={rateRows} s={s} />
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-400">
        {s.legend.waterfall} (<span className="font-semibold text-brand-700">•</span> {s.legend.overrideMark}) · {s.legend.remaining}{" "}
        {s.legend.rate} {s.legend.restrictions}{" "}
        (<span className="inline-block h-2 w-2 rounded-full bg-danger-500 align-middle" /> {s.legend.stop}&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-brand-600 align-middle" /> {s.legend.cta}&nbsp;·{" "}
        <span className="inline-block h-2 w-2 rounded-full bg-accent-500 align-middle" /> {s.legend.ctd}).
      </p>
    </div>
  );
}


function SectionRows({
  section, dates, todayIso, rateRows, s,
}: {
  section: Awaited<ReturnType<typeof getInventoryBoard>>["sections"][number];
  dates: string[];
  todayIso: string;
  rateRows: InventoryRatePlanRow[];
  s: InventoryStrings;
}) {
  return (
    <>
      {ROWS.map((key) => ({ key, label: s.rows[key] })).map((row) => (
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
                    <span title={s.manualOverride} className="ml-0.5 align-top text-[10px] font-bold text-brand-700">•</span>
                  )}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
      {/*
        ⚠️ ONE ROW PER ACTIVE PLAN, each carrying the plan's own name.
        This was a single row labelled with the literal word "Rate" — BUG-001 — plus rows for plans
        derived from it. A hotel with two independent manual plans had one of them rendered and the
        other invisible, however correctly its prices were stored.
      */}
      {rateRows.map((pl) => (
        <tr key={pl.id} className="border-b border-surface-border/40">
          <td
            className={`sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium ${pl.editable ? "text-ink-500" : "pl-4 text-ink-400"}`}
            title={pl.derived ? s.derivedFrom(pl.derived.parent, pl.derived.offset) : pl.label}
          >
            {pl.derived && <span className="mr-1 cursor-help select-none">📎</span>}
            {pl.label}
            {pl.derived && (
              <span className="tnum ml-1 rounded bg-surface-sunken px-1 text-[10px] font-semibold text-ink-500">{pl.derived.offset}</span>
            )}
          </td>
          {section.cells.map((cell, i) => {
            const value = cell.ratesByPlan[pl.id] ?? "—";
            return (
              <td key={i} className={`px-1 py-1 text-center ${pl.editable ? "" : "text-ink-400"} ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
                {pl.editable ? (
                  <span className="inline-flex items-center">
                    <RateCell roomTypeId={section.roomType.id} date={dates[i]!} value={value} ratePlanId={pl.id} {...(cell.rateNotesByPlan[pl.id] ? { note: cell.rateNotesByPlan[pl.id] } : {})} />
                    {/* Present only under per-person, and only on the headline row — a popover per
                        plan per cell is the grid growing in the direction the spec forbids. */}
                    {cell.occupancyRates && pl.id === rateRows[0]?.id && (
                      <OccupancyRatePopover
                        rates={cell.occupancyRates}
                        primaryOccupancy={section.roomType.defaultOccupancy ?? section.roomType.maxGuests}
                      />
                    )}
                  </span>
                ) : (
                  <span className="tnum text-[12px]" title={cell.rateNotesByPlan[pl.id]}>{value}</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
      <tr className="border-b border-surface-border/40 last:border-b-surface-border">
        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-[11.5px] font-medium text-ink-500">{s.restrictionsRow}</td>
        {section.cells.map((cell, i) => (
          <td key={i} className={`px-1 py-1 text-center ${dates[i] === todayIso ? "bg-brand-50/40" : ""}`}>
            {/* §5.2 — the biggest at-a-glance weakness on this grid.
                Three coloured dots and a "·" told a reader nothing without hovering every cell, one
                at a time, across a month. A restriction is a word; these are now words. */}
            <span className="inline-flex flex-wrap items-center justify-center gap-0.5">
              {cell.restr.stopSell && (
                <span title={s.chips.stopTitle} className="rounded bg-danger-500 px-1 text-[9px] font-bold uppercase tracking-wide text-white">{s.chips.stop}</span>
              )}
              {cell.restr.minLos != null && cell.restr.minLos > 1 && (
                <span title={s.chips.minTitle(cell.restr.minLos)} className="rounded bg-brand-50 px-1 text-[9px] font-bold uppercase tracking-wide text-brand-700">{s.chips.min(cell.restr.minLos)}</span>
              )}
              {cell.restr.cta && (
                <span title={s.chips.ctaTitle} className="rounded bg-brand-100 px-1 text-[9px] font-bold uppercase tracking-wide text-brand-700">{s.chips.cta}</span>
              )}
              {cell.restr.ctd && (
                <span title={s.chips.ctdTitle} className="rounded bg-accent-100 px-1 text-[9px] font-bold uppercase tracking-wide text-accent-700">{s.chips.ctd}</span>
              )}
              {!cell.restr.stopSell && !cell.restr.cta && !cell.restr.ctd && (cell.restr.minLos ?? 1) <= 1 && (
                <span className="text-[9px] text-ink-200" title={s.chips.noneTitle}>—</span>
              )}
            </span>
          </td>
        ))}
      </tr>
    </>
  );
}
