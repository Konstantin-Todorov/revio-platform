import Link from "next/link";
import { Search, BedDouble, Tags, Radio, CalendarCheck } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { cmSearch } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { reservations as resDict } from "@/lib/i18n/reservations";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { roomTypes, ratePlans, channels, reservations } = await cmSearch(term);
  const total = roomTypes.length + ratePlans.length + channels.length + reservations.length;
  const r0 = (await i18n()).t(resDict);
  const s = r0.search;

  const section = (title: string, href: string, icon: typeof BedDouble, rows: { key: string; label: string; sub?: string }[]) => {
    if (rows.length === 0) return null;
    const Icon = icon;
    return (
      <Card>
        <CardHeader title={title} />
        <ul className="divide-y divide-surface-border">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={href} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                <Icon className="h-4 w-4 text-ink-400" />
                <span className="text-[13.5px] font-semibold text-ink-900">{r.label}</span>
                {r.sub && <span className="text-[11.5px] text-ink-500">{r.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title={s.title} subtitle={term ? s.resultsFor(term) : s.subtitle} />

      {!term ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[13px] text-ink-500">{s.prompt}</p>
        </Card>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">{s.nothing(term)}</Card>
      ) : (
        <div className="space-y-4">
          {section(s.roomTypes, "/rooms-rates", BedDouble, roomTypes.map((r) => ({ key: r.id, label: r.name, sub: r.code })))}
          {section(s.ratePlans, "/rooms-rates", Tags, ratePlans.map((r) => ({ key: r.id, label: r.name, sub: r.code })))}
          {section(s.channels, "/channels", Radio, channels.map((c) => ({ key: c.id, label: c.name, sub: r0.channelStatus[c.status] ?? c.status })))}
          {section(s.reservations, "/reservations", CalendarCheck, reservations.map((r) => ({ key: r.id, label: r.guestName, sub: `${r.channel?.name ?? r0.direct} · ${r0.statuses[r.status] ?? r.status}` })))}
        </div>
      )}
    </div>
  );
}
