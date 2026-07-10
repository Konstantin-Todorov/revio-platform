import Link from "next/link";
import { BedDouble, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarBoard, getBookingOptions, CALENDAR_ROW_GROUPS } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditableCell } from "@/components/calendar/EditableCell";
import { CollapseAll } from "@/components/calendar/CollapseAll";
import { ParamMultiSelect } from "@/components/calendar/ParamMultiSelect";
import { MonthView } from "@/components/calendar/MonthView";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { weekday, dayMonth, isWeekend, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const VIEWS = [7, 14, 30];
const DAY_MS = 86_400_000;

function shift(startIso: string, byDays: number): string {
  return new Date(new Date(`${startIso}T00:00:00Z`).getTime() + byDays * DAY_MS).toISOString().slice(0, 10);
}

/** Clamp a YYYY-MM choice to [current month, +23 months] and return its first day + length. */
function monthWindow(monthParam: string | undefined) {
  const now = new Date();
  const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const max = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 23, 1));
  let first = cur;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    const req = new Date(Date.UTC(y!, m! - 1, 1));
    first = new Date(Math.min(Math.max(req.getTime(), cur.getTime()), max.getTime()));
  }
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const iso = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
  const shiftMonth = (by: number) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return { first, daysInMonth, iso, prev: shiftMonth(-1), next: shiftMonth(1) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string; end?: string; rt?: string; rows?: string; rp?: string; view?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "grid";
  const rt = sp.rt ? sp.rt.split(",").filter(Boolean) : [];
  const rows = sp.rows ? sp.rows.split(",").filter(Boolean) : [];
  const rp = sp.rp ? sp.rp.split(",").filter(Boolean) : [];
  // Custom start→end range (spec): any period, capped at 30 consecutive days so the grid stays readable.
  let customDays: number | undefined;
  if (sp.start && sp.end && /^\d{4}-\d{2}-\d{2}$/.test(sp.end) && sp.end >= sp.start) {
    const span = Math.round((Date.parse(sp.end) - Date.parse(sp.start)) / 86_400_000) + 1;
    customDays = Math.min(30, Math.max(1, span));
  }

  // Month view fetches its own window: exactly one month, same Rooms/Display filters as the grid.
  const mw = monthWindow(sp.month);
  const board =
    view === "month"
      ? await getCalendarBoard({
          start: mw.first.toISOString().slice(0, 10),
          days: mw.daysInMonth,
          rt,
          rows: rows.length > 0 ? rows : ["sold", "minlos", "cta", "ctd", "stopsell"],
        })
      : await getCalendarBoard({
          ...(sp.start ? { start: sp.start } : {}),
          days: customDays ?? (Number(sp.days) || (undefined as never)),
          rt,
          rows,
          rp,
        });
  const { property, allRoomTypes, sections, dates, days, start, visible, ratePlanOptions, selectedRp, capabilityNotes } = board;

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

  // ---- MONTH VIEW ----------------------------------------------------------
  if (view === "month") {
    const [my, mm] = mw.iso.split("-").map(Number);
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthLabel = `${MONTHS[(mm ?? 1) - 1]} ${my}`;
    // Links preserve the current filters, changing only the month.
    const monthQs = (month: string) => {
      const p = new URLSearchParams({ view: "month", month });
      if (rt.length > 0) p.set("rt", rt.join(","));
      if (rows.length > 0) p.set("rows", rows.join(","));
      return `/calendar?${p.toString()}`;
    };
    const monthGroups = CALENDAR_ROW_GROUPS.filter(([k]) => k !== "rates");
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
                <Link href="/calendar" className="rounded px-2.5 py-1 text-[12.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted">Grid</Link>
                <span className="rounded bg-brand-800 px-2.5 py-1 text-[12.5px] font-semibold text-white">Month</span>
              </div>
              {bookingOptions.demoMode && <BookingDialog options={bookingOptions} />}
            </div>
          }
        />

        {/* Month navigation + the SAME filters as the grid */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Link href={monthQs(mw.prev)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={`/calendar?view=month${rt.length > 0 ? `&rt=${rt.join(",")}` : ""}${rows.length > 0 ? `&rows=${rows.join(",")}` : ""}`} className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
              This month
            </Link>
            <Link href={monthQs(mw.next)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-white text-ink-500 transition-colors hover:bg-surface-muted">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <h2 className="text-[15px] font-bold tracking-tight text-ink-900">{monthLabel}</h2>

          {/* Jump straight to any month in the 2-year horizon */}
          <form method="GET" action="/calendar" className="flex items-center gap-1">
            <input type="hidden" name="view" value="month" />
            {rt.length > 0 && <input type="hidden" name="rt" value={rt.join(",")} />}
            {rows.length > 0 && <input type="hidden" name="rows" value={rows.join(",")} />}
            <input type="month" name="month" defaultValue={mw.iso} className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600" />
            <button type="submit" className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Go</button>
          </form>

          <ParamMultiSelect
            label="Rooms" param="rt" emptyLabel="All"
            options={allRoomTypes.map((r) => ({ value: r.code, label: r.name }))}
            selected={rt}
          />
          <ParamMultiSelect
            label="Display" param="rows" emptyLabel="Default"
            options={monthGroups.map(([value, label]) => ({ value, label }))}
            selected={rows}
          />

          <div className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px] text-ink-500">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${l.color}`} /> {l.label}</span>
            ))}
          </div>
        </div>

        {/* One collapsible month calendar per room type — first open, rest folded (months are tall). */}
        <div className="space-y-3">
          {sections.map(({ roomType, rows: sectionRows }, i) => (
            <details key={roomType.id} open={i === 0} className="group/section overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
              <summary className="flex cursor-pointer select-none items-center gap-3 border-b border-surface-border bg-surface-muted/60 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400 transition-transform group-open/section:rotate-0" />
                <span className="text-[13.5px] font-bold text-ink-900">{roomType.name}</span>
                <span className="text-[11px] font-medium text-ink-400">
                  {roomType.code} · {roomType.totalRooms} {roomType.unitKind === "bed" ? "beds" : "rooms"} · {property.baseCurrency}
                </span>
              </summary>
              <MonthView section={{ roomType, rows: sectionRows }} dates={dates} todayKey={todayKey} visible={new Set(visible)} />
            </details>
          ))}
          {sections.length === 0 && (
            <div className="rounded-lg border border-dashed border-surface-border bg-white p-10 text-center text-[13px] text-ink-400">
              No room types match the filter — clear the Rooms filter above.
            </div>
          )}
        </div>

        <p className="mt-3 text-[12px] text-ink-400">
          Same logic as the grid view — edits write the same rooms-to-sell and standard rate, derived rates
          follow, and changes push to channels on real connectivity. Badge <span className="rounded bg-brand-50 px-1 text-[10px] font-bold text-brand-700">2n</span> = minimum stay.
        </p>
      </div>
    );
  }

  // ---- GRID VIEW -----------------------------------------------------------
  const dateObjs = dates.map((d) => new Date(d + "T00:00:00Z"));

  // Links preserve the current query, changing one param.
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { start, days: String(days), rt: rt.join(","), rows: rows.join(","), rp: rp.join(","), ...over };
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
              <span className="rounded bg-brand-800 px-2.5 py-1 text-[12.5px] font-semibold text-white">Grid</span>
              <Link href={`/calendar?view=month${rt.length > 0 ? `&rt=${rt[0]}` : ""}`} className="rounded px-2.5 py-1 text-[12.5px] font-semibold text-ink-500 transition-colors hover:bg-surface-muted">
                Month
              </Link>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
              {VIEWS.map((v) => (
                <Link key={v} href={qs({ days: String(v) })} className={`rounded px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${days === v ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"}`}>
                  {v}d
                </Link>
              ))}
            </div>
            {bookingOptions.demoMode && <BookingDialog options={bookingOptions} />}
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
          {rp.length > 0 && <input type="hidden" name="rp" value={rp.join(",")} />}
          <input type="date" name="start" defaultValue={start} className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600" />
          <span className="text-[11px] text-ink-400">→</span>
          <input type="date" name="end" title="Optional end date — the view caps at 30 consecutive days" className="h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600" />
          <button type="submit" className="rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Go</button>
        </form>

        <ParamMultiSelect
          label="Rooms" param="rt" emptyLabel="All"
          options={allRoomTypes.map((r) => ({ value: r.code, label: r.name }))}
          selected={rt}
        />
        <ParamMultiSelect
          label="Rates" param="rp" emptyLabel="Standard + derived"
          options={ratePlanOptions}
          selected={rp.length > 0 ? rp : selectedRp}
        />
        <ParamMultiSelect
          label="Display" param="rows" emptyLabel="Default"
          options={CALENDAR_ROW_GROUPS.map(([value, label]) => ({ value, label }))}
          selected={visible}
        />
        <CollapseAll containerId="calendar-sections" />

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px] text-ink-500">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${l.color}`} /> {l.label}</span>
          ))}
        </div>
      </div>

      {capabilityNotes.length > 0 && (
        <p className="mb-3 text-[11.5px] text-ink-400">
          Channel limitations (not errors):{" "}
          {capabilityNotes.map((c, i) => (
            <span key={c.name}>{i > 0 && " · "}{c.name} ignores {c.missing.join(", ")}</span>
          ))}
        </p>
      )}

      {/* One collapsible section per room type — native <details>, open by default. */}
      <div id="calendar-sections" className="space-y-3">
        {sections.map(({ roomType, rows: sectionRows }) => (
          <details key={roomType.id} open className="group/section overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
            <summary className="flex cursor-pointer select-none items-center gap-3 border-b border-surface-border bg-surface-muted/60 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-4 w-4 -rotate-90 text-ink-400 transition-transform group-open/section:rotate-0" />
              <span className="text-[13.5px] font-bold text-ink-900">{roomType.name}</span>
              <span className="text-[11px] font-medium text-ink-400">
                {roomType.code} · {roomType.totalRooms} {roomType.unitKind === "bed" ? "beds" : "rooms"}
              </span>
              {/* Inline per-row bulk (spec §3.2): the bulk screen pre-scoped to this room type —
                  the SAME code path and audit trail, never a parallel implementation. */}
              <Link
                href={`/bulk-update?rt=${roomType.code}`}
                className="ml-auto rounded-md border border-surface-border bg-white px-2 py-1 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                Bulk edit
              </Link>
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
                                {...(cell.warn ? { warn: cell.warn } : {})}
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
