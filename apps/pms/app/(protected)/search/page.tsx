import Link from "next/link";
import { Search, BedDouble, User, CalendarCheck } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { globalSearch } from "@/lib/data";
import { HK_LABEL, HK_TONE, type HkStatus } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { units, guests, reservations } = await globalSearch(term);
  const total = units.length + guests.length + reservations.length;

  return (
    <div>
      <PageHeader title="Search" subtitle={term ? `Results for “${term}”` : "Search rooms, guests and reservations"} />

      {!term ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[13px] text-ink-500">Type in the search bar above to find a room, a guest, or a reservation.</p>
        </Card>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">Nothing found for “{term}”.</Card>
      ) : (
        <div className="space-y-4">
          {units.length > 0 && (
            <Card>
              <CardHeader title="Rooms" />
              <ul className="divide-y divide-surface-border">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link href="/housekeeping" className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                      <span className="flex items-center gap-2.5"><BedDouble className="h-4 w-4 text-ink-400" /><span className="text-[13.5px] font-semibold text-ink-900">{u.label}</span><span className="text-[11.5px] text-ink-500">{u.roomType.name}</span></span>
                      <StatusPill tone={HK_TONE[u.hkStatus as HkStatus]}>{HK_LABEL[u.hkStatus as HkStatus]}</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {reservations.length > 0 && (
            <Card>
              <CardHeader title="Reservations" />
              <ul className="divide-y divide-surface-border">
                {reservations.map((r) => (
                  <li key={r.id}>
                    <Link href={`/folio/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                      <span className="flex items-center gap-2.5"><CalendarCheck className="h-4 w-4 text-ink-400" /><span className="text-[13.5px] font-semibold text-ink-900">{r.guestName}</span><span className="text-[11.5px] text-ink-500">{r.lines[0]?.roomType.name ?? ""} · {r.status}</span></span>
                      <span className="text-[11.5px] font-semibold text-accent-600">Folio →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {guests.length > 0 && (
            <Card>
              <CardHeader title="Guests" />
              <ul className="divide-y divide-surface-border">
                {guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <User className="h-4 w-4 text-ink-400" />
                    <span className="text-[13.5px] font-semibold text-ink-900">{g.firstName} {g.lastName}</span>
                    <span className="text-[11.5px] text-ink-500">{[g.email, g.phone].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
