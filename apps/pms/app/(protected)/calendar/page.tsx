import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getTapeChart, type BarStatus, type TapeRow } from "@/lib/tape-chart";
import { addDaysYmd } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Colour carries status, and the legend is always on screen — a colour nobody can decode is decoration. */
const BAR_TONE: Record<BarStatus, string> = {
  arrival: "bg-accent-600 text-white",
  in_house: "bg-brand-700 text-white",
  due_out: "bg-warning-500 text-white",
  overstayed: "bg-danger-600 text-white",
  confirmed: "bg-brand-200 text-brand-900",
  blocked: "bg-ink-300 text-ink-700",
};
const BAR_LABEL: Record<BarStatus, string> = {
  arrival: "Arriving today",
  in_house: "In house",
  due_out: "Due out today",
  overstayed: "Overstayed",
  confirmed: "Confirmed",
  blocked: "Out of order",
};
const LEGEND: BarStatus[] = ["arrival", "in_house", "due_out", "overstayed", "confirmed"];

/** Column width in pixels. Fixed so the header, the bars and the footer cannot drift apart. */
const COL = 44;
const LABEL_COL = 132;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = sp.days ? Number.parseInt(sp.days, 10) : undefined;
  const { today, from, dates, rows, tapeDays } = await getTapeChart({ from: sp.from, days });

  const span = dates.length;
  const prev = addDaysYmd(from, -span);
  const next = addDaysYmd(from, span);

  // Grouped by floor, because a 120-room property is unreadable as one list and housekeeping,
  // maintenance and the eye all already think in floors.
  const byFloor = new Map<string, TapeRow[]>();
  for (const r of rows) {
    const key = r.floor ?? "—";
    byFloor.set(key, [...(byFloor.get(key) ?? []), r]);
  }

  const gridCols = `${LABEL_COL}px repeat(${span}, ${COL}px)`;

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Every room, every night. Front Desk is today; this is the weeks ahead."
        action={
          <div className="flex items-center gap-1.5">
            <Link href={`/calendar?from=${prev}&days=${span}`} aria-label="Previous period"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-border text-ink-600 transition-colors hover:bg-surface-muted">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={`/calendar?days=${span}`}
              className="inline-flex h-9 items-center rounded-md border border-surface-border px-3 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
              Today
            </Link>
            <Link href={`/calendar?from=${next}&days=${span}`} aria-label="Next period"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-border text-ink-600 transition-colors hover:bg-surface-muted">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <div className="ml-1 flex items-center gap-1">
              {[14, 30, 60].map((d) => (
                <Link key={d} href={`/calendar?from=${from}&days=${d}`}
                  className={`inline-flex h-9 items-center rounded-md px-2.5 text-[12px] font-semibold transition-colors ${
                    span === d ? "bg-brand-800 text-white" : "border border-surface-border text-ink-600 hover:bg-surface-muted"
                  }`}>
                  {d}d
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-500">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-4 rounded-sm ${BAR_TONE[s]}`} />
            {BAR_LABEL[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Pin className="h-3 w-3 text-ink-400" /> room chosen by a person — never re-assigned automatically
        </span>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarRange className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[14px] font-semibold text-ink-900">No rooms yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            The calendar draws physical rooms. Add them in{" "}
            <Link href="/rooms" className="font-semibold text-accent-600 underline">Rooms</Link> and every booking will appear here.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Horizontal scroll lives on this one container, so the page itself never scrolls sideways. */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: LABEL_COL + span * COL }}>
              {/* Date header */}
              <div className="grid border-b border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Room</div>
                {tapeDays.map((d) => (
                  <div key={d.date}
                    className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""} ${d.today ? "bg-accent-50" : ""}`}>
                    <div className={`text-[10px] uppercase ${d.today ? "font-bold text-accent-700" : "text-ink-400"}`}>
                      {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                    </div>
                    <div className={`text-[12px] font-semibold ${d.today ? "text-accent-700" : "text-ink-700"}`}>
                      {d.date.slice(8)}
                    </div>
                  </div>
                ))}
              </div>

              {[...byFloor.entries()].map(([floor, floorRows]) => (
                <div key={floor}>
                  <div className="grid border-b border-surface-border bg-surface-muted/60" style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-1 text-[11px] font-bold text-ink-500">
                      {floor === "—" ? "No floor set" : `Floor ${floor}`}
                      <span className="ml-1.5 font-normal text-ink-400">{floorRows.length}</span>
                    </div>
                  </div>

                  {floorRows.map((row) => (
                    <div key={row.unitId} className="grid border-b border-surface-border last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
                      <div className="flex items-center gap-1.5 px-3 py-2">
                        <span className="text-[13px] font-semibold text-ink-900">{row.label}</span>
                        <span className="truncate text-[10.5px] text-ink-400">{row.roomTypeName}</span>
                      </div>

                      {/* The night cells, then the bars laid over them in the same grid track space. */}
                      <div className="relative col-span-full col-start-2 grid" style={{ gridTemplateColumns: `repeat(${span}, ${COL}px)` }}>
                        {tapeDays.map((d) => (
                          <div key={d.date}
                            className={`h-9 border-l border-surface-border ${d.weekend ? "bg-brand-50/50" : ""} ${d.today ? "bg-accent-50/60" : ""}`} />
                        ))}
                        {row.bars.map((bar) => {
                          const startIdx = dates.indexOf(bar.from);
                          if (startIdx < 0) return null;
                          return (
                            <Link
                              key={`${bar.reservationId}-${bar.from}`}
                              href={`/reservation/${bar.reservationId}`}
                              title={`${bar.guestName} · ${bar.from} → ${bar.to} · ${BAR_LABEL[bar.status]}${bar.pinned ? " · room pinned" : ""}`}
                              className={`absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded px-1.5 text-[11px] font-semibold shadow-sm transition-opacity hover:opacity-90 ${BAR_TONE[bar.status]} ${
                                bar.continuesLeft ? "rounded-l-none" : ""
                              } ${bar.continuesRight ? "rounded-r-none" : ""}`}
                              style={{ left: startIdx * COL + 2, width: bar.nights * COL - 4 }}
                            >
                              {bar.pinned && <Pin className="h-2.5 w-2.5 shrink-0 opacity-80" />}
                              <span className="truncate">{bar.guestName}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* The insight layer: the shape above, the numbers below (§2.1). */}
              <div className="grid border-t-2 border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Free · occ.</div>
                {tapeDays.map((d) => (
                  <div key={d.date} className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""}`}>
                    <div className={`text-[12px] font-bold ${d.availableRooms === 0 ? "text-danger-600" : "text-ink-800"}`}>
                      {d.availableRooms}
                    </div>
                    <div className="text-[9.5px] text-ink-400">{d.occupancyPct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <p className="mt-3 text-[11px] text-ink-400">
        Showing {span} nights from {from}. Rates are not shown here — they live in RevioCRS; this grid is about rooms and people.
        Today is {today}.
      </p>
    </div>
  );
}
