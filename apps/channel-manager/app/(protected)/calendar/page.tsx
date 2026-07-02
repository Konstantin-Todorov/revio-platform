import Link from "next/link";
import { BedDouble, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarBoard, getBookingOptions, CALENDAR_ROW_GROUPS } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditableCell } from "@/components/calendar/EditableCell";
import { ParamMultiSelect } from "@/components/calendar/ParamMultiSelect";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { weekday, dayMonth, isWeekend, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const VIEWS = [7, 14, 30];
const DAY_MS = 86_400_000;

function shift(startIso: string, byDays: number): string {
  return new Date(new Date(`${startIso}T00:00:00Z`).getTime() + byDays * DAY_MS).toISOString().slice(0, 10);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string; rt?: string; rows?: string }>;
}) {
  const sp = await searchParams;
  const rt = sp.rt ? sp.rt.split(",").filter(Boolean) : [];
  const rows = sp.rows ? sp.rows.split(",").filter(Boolean) : [];
  const board = await getCalendarBoard({
    ...(sp.start ? { start: sp.start } : {}),
    days: Number(sp.days) || undefined as never,
    rt,
    rows,
  });
  const { property, allRoomTypes, sections, dates, days, start, visible } = board;

  if (allRoomTypes.length === 0) {
    return (
      <div>
        <PageHeader title="Calendar" subtitle={`${property.name} · availability, rates & restrictions`} />
        <EmptyState
          icon={<BedDouble className="h-7 w-7" />}
          title="No room types yet"
          body="The calendar shows availability and rates per room type. Add your first room type to get started."
          actionLabel="Go to Rooms & Rates"
          actionHref="/rooms-rates"
        />
      </div>
    );
  }

  const bookingOptions = await getBookingOptions();
  const todayKey = ymd(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
  const dateObjs = dates.map((d) => new Date(d + "T00:00:00Z"));

  // Links preserve the current query, changing one param.
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { start, days: String(days), rt: rt.join(","), rows: rows.join(","), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/calendar?${p.toString()}`;
  };

  const legend = [
    { label: "Stop Sell", color: "bg-danger-500" },
    { label: "CTA", color: "bg-brand-600" },
    { label: "CTD", color: "bg-accent-500" },
    { label: "Weekend", color: "bg-warning-500" },
  ];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={`${property.name} · availability, rates & restrictions`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
              {VIEWS.map((v) => (
                <Link key={v} href={qs({ days: String(v) })} className={`rounded px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${days === v ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}>
                  {v}d
                </Link>
              ))}
            </div>
            <BookingDialog options={bookingOptions} />
          </div>
        }
      />

      {/* Window navigation + filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={qs({ start: shift(start, -days) })} aria-label="Previous window" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={qs({ start: undefined })} className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
            Today
          </Link>
          <Link href={qs({ start: shift(start, days) })} aria-label="Next window" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Jump to any date within the 2-year horizon */}
        <form method="GET" action="/calendar" className="flex items-center gap-1">
          <input type="hidden" name="days" value={days} />
          {rt.length > 0 && <input type="hidden" name="rt" value={rt.join(",")} />}
          {rows.length > 0 && <input type="hidden" name="rows" value={rows.join(",")} />}
          <input type="date" name="start" defaultValue={start} className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600" />
          <button type="submit" className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Go</button>
        </form>

        <ParamMultiSelect
          label="Rooms" param="rt" emptyLabel="All"
          options={allRoomTypes.map((r) => ({ value: r.code, label: r.name }))}
          selected={rt}
        />
        <ParamMultiSelect
          label="Display" param="rows" emptyLabel="Default"
          options={CALENDAR_ROW_GROUPS.map(([value, label]) => ({ value, label }))}
          selected={visible}
        />

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px] text-ink-500">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${l.color}`} /> {l.label}</span>
          ))}
        </div>
      </div>

      {/* One collapsible section per room type — native <details>, open by default. */}
      <div className="space-y-3">
        {sections.map(({ roomType, rows: sectionRows }) => (
          <details key={roomType.id} open className="group/section overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <summary className="flex cursor-pointer select-none items-center gap-3 border-b border-surface-border bg-surface-muted/60 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400 transition-transform group-open/section:rotate-0" />
              <span className="text-[13.5px] font-bold text-ink-900">{roomType.name}</span>
              <span className="text-[11px] font-medium text-ink-400">
                {roomType.code} · {roomType.totalRooms} {roomType.unitKind === "bed" ? "beds" : "rooms"}
              </span>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[150px] border-b border-r border-surface-border bg-white px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      {property.baseCurrency}
                    </th>
                    {dateObjs.map((d) => {
                      const k = ymd(d);
                      const today = k === todayKey;
                      return (
                        <th key={k} className={`min-w-[72px] border-b border-r border-surface-border px-1.5 py-1.5 text-center last:border-r-0 ${isWeekend(d) ? "bg-warning-50/50" : "bg-white"} ${today ? "bg-brand-50" : ""}`}>
                          <div className={`text-[10px] font-semibold uppercase ${today ? "text-brand-700" : "text-ink-400"}`}>{weekday(d)}</div>
                          <div className={`tnum text-[11.5px] font-bold ${today ? "text-brand-700" : "text-ink-700"}`}>{dayMonth(d)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.map((row) => (
                    <tr key={row.key}>
                      <td className={`sticky left-0 z-10 border-b border-r border-surface-border bg-white px-4 py-1.5 text-[12px] font-semibold ${row.muted ? "pl-7 font-normal text-ink-400" : "text-ink-700"}`}>
                        {row.label}
                      </td>
                      {row.cells.map((cell, i) => {
                        const d = dateObjs[i]!;
                        const today = ymd(d) === todayKey;
                        const base = `tnum border-b border-r border-surface-border text-center text-[12.5px] last:border-r-0 ${isWeekend(d) ? "bg-warning-50/30" : ""} ${today ? "ring-1 ring-inset ring-brand-600/20" : ""}`;
                        if (row.editable && row.field) {
                          return (
                            <td key={cell.date} className={`${base} px-0.5 py-0.5`}>
                              <EditableCell
                                roomTypeId={roomType.id}
                                date={cell.date}
                                field={row.field}
                                kind={row.kind}
                                value={cell.value}
                                {...(cell.flag ? { flag: cell.flag } : {})}
                                prefix={row.kind === "price" ? "€" : ""}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={cell.date} className={`${base} px-1.5 py-1.5 ${row.muted ? "text-ink-400" : "font-semibold text-ink-900"}`}>
                            {row.kind === "price" && cell.value !== "—" ? `€${cell.value}` : cell.value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
        {sections.length === 0 && (
          <div className="rounded-lg border border-dashed border-surface-border bg-white p-10 text-center text-[13px] text-ink-400">
            No room types match the filter — clear the Rooms filter above.
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-ink-400">
        Rooms sold is derived from confirmed reservations; bookable = rooms to sell − sold. Derived rates follow the
        standard rate via <span className="font-semibold text-ink-500">@revio/core</span>. Edits push automatically to
        channels on real connectivity.
      </p>
    </div>
  );
}
