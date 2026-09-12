import Link from "next/link";
import { Users } from "lucide-react";
import { getGuests } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { GuestsTable, type GuestRow } from "@/components/guests/GuestsTable";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { property, guests } = await getGuests(sp.q);
  const rows: GuestRow[] = guests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email,
    phone: g.phone,
    company: g.company,
    bookings: g._count.reservations,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Guests"
        subtitle={`${property.name} · contact details and booking history`}
      />

      <Card className="p-3">
        <form method="GET" className="flex items-center gap-2">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email, phone, company…" className="w-72 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] outline-none transition-colors focus:border-brand-600" />
          <button className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Search</button>
          {sp.q && <Link href="/guests" className="text-[12px] font-semibold text-brand-700 hover:underline">Clear</Link>}
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
          <GuestsTable rows={rows} />
        </Card>
      )}
    </div>
  );
}
