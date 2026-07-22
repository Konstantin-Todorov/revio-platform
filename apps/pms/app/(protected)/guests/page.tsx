import { Users } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getPmsGuests } from "@/lib/guests";
import { GuestsTable, type GuestRow } from "@/components/guests/GuestsTable";

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
          <GuestsTable
            rows={rows.map<GuestRow>((g) => ({ key: g.key, name: g.name, email: g.email, stays: g.stays, nights: g.nights, ancillaryMinor: g.ancillaryMinor, lifetimeMinor: g.lifetimeMinor, lastStay: g.lastStay }))}
            currency={property.baseCurrency}
          />
        )}
      </Card>
    </div>
  );
}
