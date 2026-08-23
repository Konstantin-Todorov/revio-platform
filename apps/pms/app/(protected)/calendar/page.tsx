import Link from "next/link";
import { CalendarRange, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getTapeChart, type BarStatus } from "@/lib/tape-chart";
import { TapeGrid } from "@/components/calendar/TapeGrid";
import { moveFromCalendar } from "@/lib/actions-frontdesk";
import { addDaysYmd } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The legend, which the page owns because it sits outside the scrollable grid. */
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
          <TapeGrid
            rows={rows}
            dates={dates}
            tapeDays={tapeDays}
            col={COL}
            labelCol={LABEL_COL}
            returnTo={`/calendar?from=${from}&days=${span}`}
            moveAction={moveFromCalendar}
          />
        </Card>
      )}

      <p className="mt-3 text-[11px] text-ink-400">
        Showing {span} nights from {from}. Drag a stay onto another room to move it. Rates are not shown here —
        they live in RevioCRS; this grid is about rooms and people. Today is {today}.
      </p>
    </div>
  );
}
