import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Building2, Bed, MapPin, Wine, StickyNote } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getPmsGuestProfile } from "@/lib/guests";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", checked_in: "success", checked_out: "neutral",
  cancelled: "neutral", no_show: "warning",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="tnum mt-1 text-[18px] font-bold text-ink-900">{value}</div>
      {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPmsGuestProfile(decodeURIComponent(id));
  if (!data) notFound();
  const { property, guest, stats, favouriteItems, notes, reservations } = data;
  const cur = property.baseCurrency;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/guests" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Guests
      </Link>
      <PageHeader
        title={guest.name}
        subtitle={`${stats.stays} stay${stats.stays === 1 ? "" : "s"} · ${stats.nights} nights · operational profile`}
        action={
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-500">
            {guest.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{guest.email}</span>}
            {guest.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{guest.phone}</span>}
            {guest.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{guest.company}</span>}
          </div>
        }
      />

      {/* Derived operational stats (spec §3.3) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lifetime value" value={money(stats.lifetimeMinor, cur)} hint="room + ancillary" />
        <Stat label="Avg nightly spend" value={money(stats.avgNightlyMinor, cur)} hint="accommodation ÷ nights" />
        <Stat label="Avg ancillary / stay" value={money(stats.avgAncillaryPerStayMinor, cur)} hint="minibar + extras" />
        <Stat label="Ancillary lifetime" value={money(stats.ancillaryMinor, cur)} hint="POS consumption" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preferences derived from operational history */}
        <Card>
          <CardHeader title="Preferences" subtitle="Derived from assignment & consumption history" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Bed className="h-3.5 w-3.5" /> Preferred room</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">{stats.preferredRoom ?? "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><MapPin className="h-3.5 w-3.5" /> Preferred floor</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">{stats.preferredFloor ?? "—"}</dd>
            </div>
          </dl>
          <div className="border-t border-surface-border/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Wine className="h-3.5 w-3.5" /> Favourite items</div>
            {favouriteItems.length === 0 ? (
              <p className="mt-1 text-[12.5px] text-ink-400">No POS consumption recorded yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {favouriteItems.map((it) => (
                  <li key={it.name} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-700">{it.name} <span className="text-ink-400">×{it.count}</span></span>
                    <span className="tnum text-ink-500">{money(it.amountMinor, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Requests & notes */}
        <Card>
          <CardHeader title="Requests & notes" subtitle="Standing requests + per-stay notes" />
          {notes.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-400">No requests or notes on record. A structured complaint/issue log arrives with maintenance linkage (future).</p>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {notes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-[13px] text-ink-700">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" /> {n}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Stay history */}
      <Card className="mt-4">
        <CardHeader title={`Stay history (${reservations.length})`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Reservation</th>
                <th className="px-4 py-2.5">Stay</th>
                <th className="px-4 py-2.5">Room type</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5"><Link href={`/reservation/${r.id}`} className="tnum font-semibold text-accent-600 hover:underline">#{r.id.slice(-6)}</Link></td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{r.checkIn ?? "—"} → {r.checkOut ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-600">{r.roomType}</td>
                  <td className="px-4 py-2.5 text-ink-600">{r.source}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
