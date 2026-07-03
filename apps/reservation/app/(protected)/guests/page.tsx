import Link from "next/link";
import { Users } from "lucide-react";
import { getGuests } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { property, guests } = await getGuests(sp.q);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Guests"
        subtitle={`${property.name} · contact details + booking history — deliberately not a CRM`}
      />

      <Card className="p-3">
        <form method="GET" className="flex items-center gap-2">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email, phone, company…" className="w-72 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition-colors focus:border-brand-600" />
          <button className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Search</button>
          {sp.q && <Link href="/guests" className="text-[12px] font-semibold text-brand-700 hover:underline">Clear</Link>}
          <span className="ml-auto text-[11.5px] text-ink-400">{guests.length} shown</span>
        </form>
      </Card>

      {guests.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title={sp.q ? "No guests match" : "No guests yet"}
          body={sp.q ? "Try a different search." : "Guests appear automatically the first time a reservation is created for them."}
        />
      ) : (
        <Card>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Guest</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5 text-right">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <Link href={`/guests/${g.id}`} className="font-semibold text-brand-700 hover:underline">{g.lastName}, {g.firstName}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{g.email ?? "—"}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{g.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-600">{g.company ?? "—"}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{g._count.reservations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
