import Link from "next/link";
import { Search, BedDouble, Tags, Radio, CalendarCheck } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { cmSearch } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { roomTypes, ratePlans, channels, reservations } = await cmSearch(term);
  const total = roomTypes.length + ratePlans.length + channels.length + reservations.length;

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
      <PageHeader title="Search" subtitle={term ? `Results for “${term}”` : "Search rooms, rates, channels and reservations"} />

      {!term ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[13px] text-ink-500">Type in the search bar above to find a room type, rate plan, channel, or reservation.</p>
        </Card>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">Nothing found for “{term}”.</Card>
      ) : (
        <div className="space-y-4">
          {section("Room types", "/rooms-rates", BedDouble, roomTypes.map((r) => ({ key: r.id, label: r.name, sub: r.code })))}
          {section("Rate plans", "/rooms-rates", Tags, ratePlans.map((r) => ({ key: r.id, label: r.name, sub: r.code })))}
          {section("Channels", "/channels", Radio, channels.map((c) => ({ key: c.id, label: c.name, sub: c.status })))}
          {section("Reservations", "/reservations", CalendarCheck, reservations.map((r) => ({ key: r.id, label: r.guestName, sub: `${r.channel?.name ?? "Direct"} · ${r.status}` })))}
        </div>
      )}
    </div>
  );
}
