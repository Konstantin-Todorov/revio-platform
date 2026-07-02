import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EditableCell } from "./EditableCell";
import type { CalendarRow } from "@/lib/data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface MonthSection {
  roomType: { id: string; name: string; code: string; totalRooms: number; unitKind: string };
  rows: CalendarRow[];
}

/**
 * Classic month-calendar layout over the SAME board data and edit logic as the grid view:
 * each day cell shows rooms-to-sell (editable), rooms sold (derived), the standard rate (editable),
 * and the restriction flags. One room type at a time.
 */
export function MonthView({
  section, dates, monthIso, todayKey, currency, nav,
}: {
  section: MonthSection;
  dates: string[]; // the month's date keys, in order
  monthIso: string; // YYYY-MM
  todayKey: string;
  currency: string;
  nav: { prev: string; next: string; thisMonth: string };
}) {
  const [yy, mm] = monthIso.split("-").map(Number);
  const label = `${MONTHS[(mm ?? 1) - 1]} ${yy}`;
  const first = new Date(`${dates[0]}T00:00:00Z`);
  const leadingBlanks = (first.getUTCDay() + 6) % 7; // Monday-first offset

  const rowByKey = new Map(section.rows.map((r) => [r.key, r]));
  const idx = new Map(dates.map((d, i) => [d, i]));
  const cellOf = (key: string, date: string) => rowByKey.get(key)?.cells[idx.get(date) ?? -1];

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={nav.prev} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={nav.thisMonth} className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
            This month
          </Link>
          <Link href={nav.next} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <h2 className="text-[15px] font-bold tracking-tight text-ink-900">{label}</h2>
        <span className="text-[11px] font-medium text-ink-400">
          {section.roomType.name} · {section.roomType.totalRooms} {section.roomType.unitKind === "bed" ? "beds" : "rooms"} · {currency}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/60">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[96px] border-b border-r border-surface-border/60 bg-surface-muted/30" />
          ))}
          {dates.map((d, i) => {
            const dayNum = Number(d.slice(8, 10));
            const isToday = d === todayKey;
            const col = (leadingBlanks + i) % 7;
            const weekend = col >= 5;
            const stop = cellOf("stopsell", d)?.flag === "stop";
            const cta = cellOf("cta", d)?.flag === "cta";
            const ctd = cellOf("ctd", d)?.flag === "ctd";
            const inv = cellOf("inventory", d);
            const sold = cellOf("sold", d)?.value ?? "0";
            const price = cellOf("standard", d);

            return (
              <div
                key={d}
                className={`min-h-[96px] border-b border-r border-surface-border/60 p-1.5 ${weekend ? "bg-warning-50/30" : ""} ${isToday ? "ring-2 ring-inset ring-brand-600/30" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`tnum text-[11.5px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>{dayNum}</span>
                  <span className="flex items-center gap-1">
                    {stop && <span title="Stop sell" className="inline-block h-2 w-2 rounded-full bg-danger-500" />}
                    {cta && <span title="Closed to arrival" className="inline-block h-2 w-2 rounded-full bg-brand-600" />}
                    {ctd && <span title="Closed to departure" className="inline-block h-2 w-2 rounded-full bg-accent-500" />}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                  <span className="w-7 shrink-0">Sell</span>
                  {inv && (
                    <EditableCell roomTypeId={section.roomType.id} date={d} field="inventory" kind="availability" value={inv.value} />
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                  <span className="w-7 shrink-0">Sold</span>
                  <span className="tnum px-1 text-[12px] font-semibold text-ink-500">{sold}</span>
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                  <span className="w-7 shrink-0">Rate</span>
                  {price && (
                    <EditableCell roomTypeId={section.roomType.id} date={d} field="price" kind="price" value={price.value} prefix="€" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[12px] text-ink-400">
        Same logic as the grid view — edits here write the same rooms-to-sell and standard rate, derived
        rates follow, and changes push to channels on real connectivity. Dots: red = stop sell, navy = CTA,
        purple = CTD.
      </p>
    </div>
  );
}
