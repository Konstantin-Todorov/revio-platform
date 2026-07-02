import { getReservations, getBookingOptions } from "@/lib/data";
import { cancelReservation } from "@/lib/actions-calendar";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { money, relativeTime, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", failed_import: "danger", overbooked: "danger",
};

const STATUSES = ["confirmed", "modified", "cancelled", "failed_import", "overbooked"];

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; q?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const filters = {
    ...(sp.channel ? { channel: sp.channel } : {}),
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  };
  const [reservations, options] = await Promise.all([getReservations(filters), getBookingOptions()]);
  const filtered = Object.keys(filters).length > 0;

  const fieldCls = "h-8 rounded-md border border-surface-border bg-white px-2 text-[12.5px] text-ink-700 outline-none focus:border-brand-600";

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle="Bookings imported from channels — read-only, but you can cancel to restore availability"
        action={<BookingDialog options={options} />}
      />

      {/* Filters — plain GET form, server-rendered results. */}
      <form method="GET" action="/reservations" className="mb-3 flex flex-wrap items-center gap-2">
        <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Guest or booking #" className={`${fieldCls} w-44`} />
        <select name="channel" defaultValue={sp.channel ?? ""} className={fieldCls}>
          <option value="">All channels</option>
          {options.channels.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={fieldCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <label className="flex items-center gap-1 text-[12px] text-ink-500">
          check-in <input type="date" name="from" defaultValue={sp.from ?? ""} className={fieldCls} />
        </label>
        <label className="flex items-center gap-1 text-[12px] text-ink-500">
          → <input type="date" name="to" defaultValue={sp.to ?? ""} className={fieldCls} />
        </label>
        <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Filter</button>
        {filtered && (
          <a href="/reservations" className="rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-ink-500 hover:bg-surface-muted">Clear</a>
        )}
        <span className="ml-auto text-[12px] text-ink-400">{reservations.length} result{reservations.length === 1 ? "" : "s"}</span>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Channel", "Reservation", "Guest", "Room · Rate", "Check-in", "Check-out", "Status", "Total", "Imported"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const line = r.lines[0];
                return (
                  <tr key={r.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.channel.name}</td>
                    <td className="tnum px-4 py-3 text-ink-500">#{r.externalId}</td>
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.guestName}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {line ? <>{line.roomType.name}{line.quantity > 1 && <span className="ml-1 font-semibold text-brand-600">×{line.quantity}</span>}<span className="text-ink-400"> · {line.ratePlan.name}</span></> : "—"}
                    </td>
                    <td className="tnum px-4 py-3 text-ink-600">{line ? ymd(line.checkIn) : "—"}</td>
                    <td className="tnum px-4 py-3 text-ink-600">{line ? ymd(line.checkOut) : "—"}</td>
                    <td className="px-4 py-3"><StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusPill></td>
                    <td className="tnum px-4 py-3 font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                    <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(r.importedAt)}</td>
                    <td className="px-2 py-3">
                      {r.status !== "cancelled" && (
                        <form action={cancelReservation} className="opacity-0 transition-opacity group-hover:opacity-100">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:border-danger-500 hover:text-danger-600">Cancel</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
