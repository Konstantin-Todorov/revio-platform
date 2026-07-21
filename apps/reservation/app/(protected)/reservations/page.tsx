import Link from "next/link";
import { CalendarPlus, CalendarCheck } from "lucide-react";
import { getActiveHolds, getReservationsList, type CrsDateType } from "@/lib/data";
import { HoldCountdown } from "@/components/reservations/HoldCountdown";
import { ReservationsTable, type ResRow } from "@/components/reservations/ReservationsTable";
import { releaseExpiredHolds } from "@/lib/holds";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

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
  // Serialize the (already filtered) rows for the client sortable table (§3.1 — sort respects filters).
  const rows: ResRow[] = reservations.map((r) => {
    const line = r.lines[0];
    return {
      id: r.id, guestName: r.guestName, externalId: r.externalId,
      checkIn: line ? line.checkIn.toISOString().slice(0, 10) : null,
      checkOut: line ? line.checkOut.toISOString().slice(0, 10) : null,
      roomTypeName: line?.roomType.name ?? null, quantity: line?.quantity ?? 1,
      source: r.channel?.name ?? r.bookingSource?.name ?? "Direct",
      totalMinor: r.totalMinor, currency: r.currency, status: r.status,
      bookedIso: r.importedAt.toISOString().slice(0, 10),
    };
  });

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
          <ReservationsTable rows={rows} />
        </Card>
      )}
    </div>
  );
}
