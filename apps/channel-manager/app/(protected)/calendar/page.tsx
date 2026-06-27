import Link from "next/link";
import { BedDouble } from "lucide-react";
import { getCalendar, getBookingOptions } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditableCell } from "@/components/calendar/EditableCell";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { weekday, dayMonth, isWeekend, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const VIEWS = [7, 14, 30];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string; days?: string }>;
}) {
  const sp = await searchParams;
  const days = VIEWS.includes(Number(sp.days)) ? Number(sp.days) : 7;
  const { property, roomTypes, roomType, dates, rows, currency } = await getCalendar(sp.rt, days);

  if (!roomType) {
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

  const legend = [
    { label: "Stop Sell", color: "bg-danger-500" },
    { label: "CTD", color: "bg-accent-500" },
    { label: "Min LOS", color: "bg-brand-600" },
    { label: "Weekend", color: "bg-warning-500" },
  ];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle={`${property.name} · availability, rates & restrictions`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-white p-0.5">
              {VIEWS.map((v) => (
                <Link
                  key={v}
                  href={`/calendar?rt=${roomType.code}&days=${v}`}
                  className={`rounded px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                    days === v ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted"
                  }`}
                >
                  {v}d
                </Link>
              ))}
            </div>
            <BookingDialog options={bookingOptions} defaultRoomTypeId={roomType.id} />
          </div>
        }
      />

      {/* Room type tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {roomTypes.map((rt) => (
          <Link
            key={rt.id}
            href={`/calendar?rt=${rt.code}&days=${days}`}
            className={`rounded-md border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              rt.id === roomType.id
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-surface-border bg-white text-ink-500 hover:bg-surface-muted"
            }`}
          >
            {rt.name}
            <span className="ml-1.5 text-[11px] text-ink-400">{rt.code}</span>
          </Link>
        ))}
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11.5px] text-ink-500">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${l.color}`} /> {l.label}
          </span>
        ))}
        <span className="ml-auto text-ink-400">Base currency · {currency}</span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-surface-border bg-white shadow-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-surface-border bg-white px-4 py-3 text-left">
                <div className="text-[13.5px] font-bold text-ink-900">{roomType.name}</div>
                <div className="text-[11px] font-medium text-ink-400">
                  {roomType.code} · {roomType.totalRooms} {roomType.unitKind === "bed" ? "beds" : "rooms"}
                </div>
              </th>
              {dateObjs.map((d) => {
                const k = ymd(d);
                const today = k === todayKey;
                return (
                  <th
                    key={k}
                    className={`min-w-[78px] border-b border-r border-surface-border px-2 py-2 text-center last:border-r-0 ${
                      isWeekend(d) ? "bg-warning-50/50" : "bg-white"
                    } ${today ? "bg-brand-50" : ""}`}
                  >
                    <div className={`text-[11px] font-semibold uppercase ${today ? "text-brand-700" : "text-ink-400"}`}>{weekday(d)}</div>
                    <div className={`tnum text-[12.5px] font-bold ${today ? "text-brand-700" : "text-ink-700"}`}>{dayMonth(d)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="group">
                <td
                  className={`sticky left-0 z-10 border-b border-r border-surface-border bg-white px-4 py-2 text-[12.5px] font-semibold ${
                    row.kind === "availability" ? "text-ink-900" : row.kind === "price" ? "text-ink-700" : "text-ink-500"
                  } ${row.muted ? "pl-7 font-normal text-ink-400" : ""}`}
                >
                  {row.label}
                </td>
                {row.cells.map((cell, i) => {
                  const d = dateObjs[i]!;
                  const today = ymd(d) === todayKey;
                  const base = `tnum border-b border-r border-surface-border text-center text-[13px] last:border-r-0 ${
                    isWeekend(d) ? "bg-warning-50/30" : ""
                  } ${today ? "ring-1 ring-inset ring-brand-600/20" : ""}`;

                  if (row.editable && row.field) {
                    return (
                      <td key={cell.date} className={`${base} px-1 py-1`}>
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
                  // Read-only row: derived rates show €, counts (e.g. Rooms sold) show a plain number.
                  return (
                    <td key={cell.date} className={`${base} px-2 py-2 ${row.muted ? "text-ink-400" : "font-semibold text-ink-900"}`}>
                      {cell.value === "—" ? "—" : row.kind === "price" ? `€${cell.value}` : cell.value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-ink-400">
        Derived rates (Non&nbsp;Refundable, Breakfast) are computed from the Standard Rate by the
        <span className="font-semibold text-ink-500"> @revio/core</span> rate engine — edit Standard and they follow.
      </p>
    </div>
  );
}
