import Link from "next/link";
import { Search, BedDouble, User, CalendarCheck } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { globalSearch } from "@/lib/data";
import { HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";
import { common } from "@/lib/i18n/common";
import { guests as guestsDict } from "@/lib/i18n/guests";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { units, guests, reservations } = await globalSearch(term);
  const total = units.length + guests.length + reservations.length;
  const { t: tr } = await i18n();
  const t = tr(pages).search;
  const hkLabel = tr(common).statuses as Record<string, string>;
  const resStatus = tr(guestsDict).profile.statuses;

  return (
    <div>
      <PageHeader title={t.title} subtitle={term ? t.results(term) : t.prompt} />

      {!term ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[13px] text-ink-500">{t.empty}</p>
        </Card>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">{t.nothing(term)}</Card>
      ) : (
        <div className="space-y-4">
          {units.length > 0 && (
            <Card>
              <CardHeader title={t.rooms} />
              <ul className="divide-y divide-surface-border">
                {units.map((u) => (
                  <li key={u.id}>
                    <Link href="/housekeeping" className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                      <span className="flex items-center gap-2.5"><BedDouble className="h-4 w-4 text-ink-400" /><span className="text-[13.5px] font-semibold text-ink-900">{u.label}</span><span className="text-[11.5px] text-ink-500">{u.roomType.name}</span></span>
                      <StatusPill tone={HK_TONE[u.hkStatus as HkStatus]}>{hkLabel[u.hkStatus] ?? u.hkStatus}</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {reservations.length > 0 && (
            <Card>
              <CardHeader title={t.reservations} />
              <ul className="divide-y divide-surface-border">
                {reservations.map((r) => (
                  <li key={r.id}>
                    <Link href={`/folio/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                      <span className="flex items-center gap-2.5"><CalendarCheck className="h-4 w-4 text-ink-400" /><span className="text-[13.5px] font-semibold text-ink-900">{r.guestName}</span><span className="text-[11.5px] text-ink-500">{r.lines[0]?.roomType.name ?? ""} · {resStatus[r.status] ?? r.status}</span></span>
                      <span className="text-[11.5px] font-semibold text-accent-600">{t.folio}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {guests.length > 0 && (
            <Card>
              <CardHeader title={t.guests} />
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
