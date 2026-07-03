import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, PencilLine } from "lucide-react";
import { getReservationDetail, getCreateFormData, PAYMENT_GUARANTEES } from "@/lib/data";
import { cancelCrsReservation, markNoShow, modifyReservation } from "@/lib/actions-reservations";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { money, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral", hold: "warning", draft: "neutral",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

export default async function ReservationDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getReservationDetail(id);
  if (!detail) notFound();
  const { property, reservation: r, timeline, todayIso } = detail;
  const line = r.lines[0];
  const { roomTypes } = await getCreateFormData();

  const isLive = ["confirmed", "modified", "overbooked"].includes(r.status);
  const checkInIso = line?.checkIn.toISOString().slice(0, 10) ?? "";
  const canNoShow = isLive && r.status !== "overbooked" && checkInIso < todayIso;
  const guarantee = PAYMENT_GUARANTEES.find((g) => g.value === r.paymentGuarantee)?.label ?? "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title={r.guestName}
        subtitle={`Reservation #${r.externalId ?? r.id.slice(-6)} · ${property.name}`}
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone={TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill>
            <Link href="/reservations" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← All reservations</Link>
          </div>
        }
      />

      {sp.error && (
        <div className="flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {sp.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stay" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]">
            <dt className="text-ink-400">Room</dt>
            <dd className="font-semibold text-ink-900">{line ? `${line.roomType.name}${line.quantity > 1 ? ` ×${line.quantity}` : ""}` : "—"}</dd>
            <dt className="text-ink-400">Dates</dt>
            <dd className="tnum text-ink-700">{line ? `${checkInIso} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}</dd>
            <dt className="text-ink-400">Guests</dt>
            <dd className="text-ink-700">{line?.guestsCount ?? "—"}</dd>
            <dt className="text-ink-400">Rate plan</dt>
            <dd className="text-ink-700">{line?.ratePlan.name ?? "—"}</dd>
            <dt className="text-ink-400">Total</dt>
            <dd className="tnum font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</dd>
            <dt className="text-ink-400">Source</dt>
            <dd className="text-ink-700">{r.channel?.name ?? r.bookingSource?.name ?? "Direct"}</dd>
            <dt className="text-ink-400">Payment guarantee</dt>
            <dd className="text-ink-700">{guarantee}</dd>
            <dt className="text-ink-400">Booked</dt>
            <dd className="tnum text-ink-700">{r.importedAt.toISOString().slice(0, 10)}</dd>
            {r.cancelledAt && (<><dt className="text-ink-400">Cancelled</dt><dd className="tnum text-ink-700">{r.cancelledAt.toISOString().slice(0, 10)}</dd></>)}
            {r.notes && (<><dt className="text-ink-400">Notes</dt><dd className="text-ink-700">{r.notes}</dd></>)}
          </dl>
          {isLive && (
            <div className="flex items-center gap-2 border-t border-surface-border/60 px-4 py-3">
              <form action={cancelCrsReservation}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-md border border-danger-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-danger-600 transition-colors hover:bg-danger-50">
                  Cancel reservation
                </button>
              </form>
              {canNoShow && (
                <form action={markNoShow}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-md border border-warning-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-warning-600 transition-colors hover:bg-warning-50">
                    Mark no-show
                  </button>
                </form>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Guest" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]">
            <dt className="text-ink-400">Name</dt>
            <dd className="font-semibold text-ink-900">
              {r.guest ? <Link href={`/guests/${r.guest.id}`} className="text-brand-700 hover:underline">{r.guest.firstName} {r.guest.lastName}</Link> : r.guestName}
            </dd>
            <dt className="text-ink-400">Email</dt><dd className="text-ink-700">{r.guest?.email ?? "—"}</dd>
            <dt className="text-ink-400">Phone</dt><dd className="tnum text-ink-700">{r.guest?.phone ?? "—"}</dd>
            <dt className="text-ink-400">Company</dt><dd className="text-ink-700">{r.guest?.company ?? "—"}</dd>
            <dt className="text-ink-400">Special requests</dt><dd className="text-ink-700">{r.guest?.specialRequests ?? "—"}</dd>
          </dl>
        </Card>
      </div>

      {isLive && line && (
        <Card>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-bold text-ink-900 hover:bg-surface-muted">
              <PencilLine className="h-4 w-4 text-brand-700" /> Modify stay
              <span className="text-[11.5px] font-medium text-ink-400">— validated first; if the new stay doesn’t fit, nothing changes</span>
            </summary>
            <form action={modifyReservation} className="grid grid-cols-2 items-end gap-3 border-t border-surface-border/60 p-4 lg:grid-cols-6">
              <input type="hidden" name="id" value={r.id} />
              <div>
                <label className={labelCls}>Room type</label>
                <select name="roomTypeId" defaultValue={line.roomTypeId} className={inputCls}>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Arrival</label><input type="date" name="checkIn" defaultValue={checkInIso} className={inputCls} /></div>
              <div><label className={labelCls}>Departure</label><input type="date" name="checkOut" defaultValue={line.checkOut.toISOString().slice(0, 10)} className={inputCls} /></div>
              <div><label className={labelCls}>Rooms</label><input type="number" name="quantity" min={1} defaultValue={line.quantity} className={inputCls} /></div>
              <div><label className={labelCls}>Total ({r.currency})</label><input type="number" name="price" step="0.01" min="0" defaultValue={(r.totalMinor / 100).toFixed(2)} className={inputCls} /></div>
              <button className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">Apply change</button>
            </form>
          </details>
        </Card>
      )}

      <Card>
        <CardHeader title="Timeline" />
        {timeline.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">No events recorded for this reservation yet.</div>
        ) : (
          <ul className="divide-y divide-surface-border/60">
            {timeline.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 px-4 py-2.5 text-[13px]">
                <span className="font-semibold capitalize text-ink-900">{e.field ?? "event"}</span>
                {e.oldValue && <span className="text-ink-400 line-through">{e.oldValue}</span>}
                {e.newValue && <span className="text-ink-700">{e.newValue}</span>}
                <span className="ml-auto text-[11.5px] text-ink-400">{relativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
