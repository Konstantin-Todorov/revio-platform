import { EditableCell } from "./EditableCell";
import type { CalendarRow } from "@/lib/data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface MonthSection {
  roomType: { id: string; name: string; code: string; totalRooms: number; unitKind: string };
  rows: CalendarRow[];
}

/**
 * One room type's month as a classic calendar — SAME board data and edit logic as the grid view.
 * Day cells: rooms-to-sell (editable) · rooms sold (derived) · standard rate (editable) · min-stay
 * badge · stop/CTA/CTD dots. Which optional pieces show is driven by the shared "Customise display"
 * selection (`visible`), exactly like the grid's row groups.
 */
export function MonthView({
  section, dates, todayKey, visible,
}: {
  section: MonthSection;
  dates: string[]; // the month's date keys, in order
  todayKey: string;
  visible: Set<string>;
}) {
  const first = new Date(`${dates[0]}T00:00:00Z`);
  const leadingBlanks = (first.getUTCDay() + 6) % 7; // Monday-first offset

  const rowByKey = new Map(section.rows.map((r) => [r.key, r]));
  const idx = new Map(dates.map((d, i) => [d, i]));
  const cellOf = (key: string, date: string) => rowByKey.get(key)?.cells[idx.get(date) ?? -1];

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface-muted/60">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400">{w}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[92px] border-b border-r border-surface-border/60 bg-surface-muted/30" />
        ))}
        {dates.map((d, i) => {
          const dayNum = Number(d.slice(8, 10));
          const isToday = d === todayKey;
          const col = (leadingBlanks + i) % 7;
          const weekend = col >= 5;
          const stop = visible.has("stopsell") && cellOf("stopsell", d)?.flag === "stop";
          const cta = visible.has("cta") && cellOf("cta", d)?.flag === "cta";
          const ctd = visible.has("ctd") && cellOf("ctd", d)?.flag === "ctd";
          const inv = cellOf("inventory", d);
          const sold = cellOf("sold", d)?.value;
          const price = cellOf("standard", d);
          const minLos = visible.has("minlos") ? cellOf("minlos", d)?.value : undefined;

          return (
            <div
              key={d}
              className={`min-h-[92px] border-b border-r border-surface-border/60 p-1.5 transition-colors hover:bg-brand-50/40 ${weekend ? "bg-warning-50/30" : ""} ${isToday ? "ring-2 ring-inset ring-brand-600/30" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`tnum text-[11.5px] font-bold ${isToday ? "text-brand-700" : "text-ink-700"}`}>{dayNum}</span>
                <span className="flex items-center gap-1">
                  {minLos && minLos !== "—" && (
                    <span title={`Min stay ${minLos} nights`} className="rounded bg-brand-50 px-1 text-[9px] font-bold text-brand-700">{minLos}n</span>
                  )}
                  {stop && <span title="Stop sell" className="inline-block h-2 w-2 rounded-full bg-danger-500" />}
                  {cta && <span title="Closed to arrival" className="inline-block h-2 w-2 rounded-full bg-brand-600" />}
                  {ctd && <span title="Closed to departure" className="inline-block h-2 w-2 rounded-full bg-accent-500" />}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                <span className="w-7 shrink-0">Sell</span>
                {inv && <EditableCell roomTypeId={section.roomType.id} date={d} field="inventory" kind="availability" value={inv.value} {...(inv.warn ? { warn: inv.warn } : {})} />}
              </div>
              {visible.has("sold") && sold !== undefined && (
                <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                  <span className="w-7 shrink-0">Sold</span>
                  <span className="tnum px-1 text-[12px] font-semibold text-ink-500">{sold}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[10.5px] text-ink-400">
                <span className="w-7 shrink-0">Rate</span>
                {price && <EditableCell roomTypeId={section.roomType.id} date={d} field="price" kind="price" value={price.value} prefix="€" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
