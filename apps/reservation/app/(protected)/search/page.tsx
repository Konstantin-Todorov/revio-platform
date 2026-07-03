import Link from "next/link";
import { SearchX } from "lucide-react";
import { globalSearch } from "@/lib/data";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const { property, reservations } = await globalSearch(q);

  return (
    <div className="space-y-4">
      <PageHeader
        title={q ? `Search: “${q}”` : "Global Search"}
        subtitle={`${property.name} · ${reservations.length} reservation${reservations.length === 1 ? "" : "s"} found — searches guest, phone, email, company, room, channel, source and status`}
      />

      {reservations.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-7 w-7" />}
          title={q ? "Nothing matches" : "Type a search above"}
          body={q ? "Try a guest name, phone number, e-mail, room type, channel or a status like “cancelled”." : "The topbar search finds reservations from anywhere in the app."}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {["Guest", "Contact", "Stay", "Room", "Source", "Total", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
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
                      <td className="px-4 py-2.5 text-[12px] text-ink-500">{r.guest?.email ?? "—"}{r.guest?.phone ? ` · ${r.guest.phone}` : ""}</td>
                      <td className="tnum px-4 py-2.5 text-ink-600">{line ? `${line.checkIn.toISOString().slice(0, 10)} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-ink-600">{line?.roomType.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-ink-600">{r.channel?.name ?? r.bookingSource?.name ?? "Direct"}</td>
                      <td className="tnum px-4 py-2.5 font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                      <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
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
