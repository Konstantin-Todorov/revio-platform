import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuestDetail } from "@/lib/data";
import { updateGuest } from "@/lib/actions-reservations";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGuestDetail(id);
  if (!detail) notFound();
  const { property, guest } = detail;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        subtitle={`${property.name} · guest since ${guest.createdAt.toISOString().slice(0, 10)}`}
        action={<Link href="/guests" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← All guests</Link>}
      />

      <Card>
        <CardHeader title="Contact & requests" />
        <form action={updateGuest} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-3">
          <input type="hidden" name="id" value={guest.id} />
          <div><label className={labelCls}>First name</label><input name="firstName" defaultValue={guest.firstName} className={inputCls} /></div>
          <div><label className={labelCls}>Last name</label><input name="lastName" defaultValue={guest.lastName} className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input type="email" name="email" defaultValue={guest.email ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Phone</label><input name="phone" defaultValue={guest.phone ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Company</label><input name="company" defaultValue={guest.company ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Special requests</label><input name="specialRequests" defaultValue={guest.specialRequests ?? ""} className={inputCls} /></div>
          <div className="col-span-2 flex justify-end lg:col-span-3">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save</button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Booking history (${guest.reservations.length})`} />
        {guest.reservations.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">No reservations for this guest yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Reservation</th>
                <th className="px-4 py-2.5">Stay</th>
                <th className="px-4 py-2.5">Room</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {guest.reservations.map((r) => {
                const line = r.lines[0];
                return (
                  <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      <Link href={`/reservations/${r.id}`} className="tnum font-semibold text-brand-700 hover:underline">#{r.externalId ?? r.id.slice(-6)}</Link>
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{line ? `${line.checkIn.toISOString().slice(0, 10)} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{line?.roomType.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{r.channel?.name ?? r.bookingSource?.name ?? "Direct"}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
