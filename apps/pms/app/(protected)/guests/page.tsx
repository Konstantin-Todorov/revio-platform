import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getPmsGuests } from "@/lib/guests";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const { property, rows } = await getPmsGuests();

  return (
    <div>
      <PageHeader
        title="Guests"
        subtitle={`${property.name} · operational profiles built from folios, POS consumption and room history`}
      />

      <Card>
        <CardHeader title={`Guests with a stay here (${rows.length})`} action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><Users className="h-3.5 w-3.5" />{rows.length}</span>} />
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-ink-400">No guests with a stay at this property yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2.5">Guest</th>
                  <th className="px-4 py-2.5 text-right">Stays</th>
                  <th className="px-4 py-2.5 text-right">Nights</th>
                  <th className="px-4 py-2.5 text-right">Ancillary spend</th>
                  <th className="px-4 py-2.5 text-right">Lifetime</th>
                  <th className="px-4 py-2.5">Last stay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.key} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      <Link href={`/guests/${encodeURIComponent(g.key)}`} className="font-semibold text-accent-600 hover:underline">{g.name}</Link>
                      {g.email && <div className="text-[11.5px] text-ink-400">{g.email}</div>}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-ink-700">{g.stays}</td>
                    <td className="tnum px-4 py-2.5 text-right text-ink-700">{g.nights}</td>
                    <td className="tnum px-4 py-2.5 text-right text-ink-600">{g.ancillaryMinor > 0 ? money(g.ancillaryMinor, property.baseCurrency) : "—"}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(g.lifetimeMinor, property.baseCurrency)}</td>
                    <td className="tnum px-4 py-2.5 text-ink-500">{g.lastStay ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-surface-border/60 px-4 py-2 text-[11px] text-ink-400">
          The richer operational profile the CRS deliberately isn’t — surfaced at the moment of action (check-in, assignment).
        </p>
      </Card>
    </div>
  );
}
