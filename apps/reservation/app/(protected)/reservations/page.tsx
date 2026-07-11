import Link from "next/link";
import { CalendarPlus, CalendarCheck } from "lucide-react";
import { getActiveHolds, getReservationsList, type CrsDateType } from "@/lib/data";
import { HoldCountdown } from "@/components/reservations/HoldCountdown";
import { releaseExpiredHolds } from "@/lib/holds";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral", hold: "warning", draft: "neutral",
};

// Full lifecycle (spec §3.3): Draft → Hold → Confirmed → Archived (+ Expired, Failed) —
// holds and drafts are filterable states, not hidden behind "Any status".
const STATUSES = ["confirmed", "modified", "hold", "draft", "cancelled", "no_show", "overbooked", "failed_import", "expired"];

const DATE_TYPES: { value: CrsDateType; label: string }[] = [
  { value: "check_in", label: "Check-in" },
  { value: "check_out", label: "Check-out" },
  { value: "created", label: "Reservation made on" },
  { value: "cancelled", label: "Cancellation date" },
  { value: "stay", label: "Staying on (in-house)" },
];

const inputCls =
  "rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; dateType?: string }>;
}) {
  const sp = await searchParams;
  await releaseExpiredHolds();
  const dateType = (DATE_TYPES.some((d) => d.value === sp.dateType) ? sp.dateType : "check_in") as CrsDateType;
  const [{ property, reservations }, holds] = await Promise.all([
    getReservationsList({ ...sp, dateType }),
    getActiveHolds(),
  ]);
  const filtered = Boolean(sp.q || sp.status || sp.from || sp.to);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reservations"
        subtitle={`${property.name} · the system of record — every booking from every source`}
        action={
          <Link href="/reservations/new" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <CalendarPlus className="h-3.5 w-3.5" /> New reservation
          </Link>
        }
      />

      <Card className="p-3">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Guest, email, phone, ID…" className={`${inputCls} w-56`} />
          <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          {/* Date type governs which date the from→to range filters on (spec §3.3). */}
          <select name="dateType" defaultValue={dateType} className={inputCls}>
            {DATE_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputCls} />
          <span className="text-[11.5px] text-ink-400">→</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputCls} />
          <button className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Filter</button>
          {filtered && <Link href="/reservations" className="text-[12px] font-semibold text-brand-700 hover:underline">Clear</Link>}
          <span className="ml-auto text-[11.5px] text-ink-400">{reservations.length} shown</span>
        </form>
      </Card>

      {/* Live holds (spec §3.3): locked inventory with a running TTL — actionable, always visible. */}
      {holds.length > 0 && (
        <Card className="border-warning-600/30 bg-warning-50/40 p-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning-700">
            {holds.length} live hold{holds.length > 1 ? "s" : ""} — inventory locked until confirmed or expired
          </div>
          <ul className="space-y-1">
            {holds.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-700">
                <span className="font-semibold">{h.roomType.name}</span>
                <span className="tnum text-ink-500">×{h.quantity} · {h.checkIn.toISOString().slice(0, 10)} → {h.checkOut.toISOString().slice(0, 10)}</span>
                {h.reservation && (
                  <Link href={`/reservations/${h.reservation.id}`} className="font-semibold text-brand-700 hover:underline">
                    {h.reservation.guestName}
                  </Link>
                )}
                <span className="text-ink-400">expires in</span> <HoldCountdown expiresAt={h.expiresAt.toISOString()} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reservations.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-7 w-7" />}
          title={filtered ? "Nothing matches these filters" : "No reservations yet"}
          body={filtered ? "Loosen the filters or clear them to see everything." : "Create the first one — the Availability Search flows straight into a held, confirmable booking."}
          actionLabel="New reservation"
          actionHref="/reservations/new"
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2.5">Guest</th>
                  <th className="px-4 py-2.5">Stay</th>
                  <th className="px-4 py-2.5">Room</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Booked</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const line = r.lines[0];
                  return (
                    <tr key={r.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-2.5">
                        <Link href={`/reservations/${r.id}`} className="font-semibold text-brand-700 hover:underline">{r.guestName}</Link>
                        <div className="tnum text-[11px] text-ink-400">#{r.externalId ?? r.id.slice(-6)}</div>
                      </td>
                      <td className="tnum px-4 py-2.5 text-ink-600">
                        {line ? `${line.checkIn.toISOString().slice(0, 10)} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-ink-600">{line ? `${line.roomType.name}${line.quantity > 1 ? ` ×${line.quantity}` : ""}` : "—"}</td>
                      <td className="px-4 py-2.5 text-ink-600">{r.channel?.name ?? r.bookingSource?.name ?? "Direct"}</td>
                      <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                      <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
                      <td className="tnum px-4 py-2.5 text-ink-500">{r.importedAt.toISOString().slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
