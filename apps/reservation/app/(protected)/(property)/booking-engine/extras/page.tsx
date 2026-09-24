import { Card, CardHeader } from "@/components/ui/primitives";
import { ExtrasEditor, type EditableExtra } from "@/components/booking-engine/ExtrasEditor";
import { prisma } from "@/lib/db";
import { bookingEnginePage } from "@/lib/booking-engine-page";

export const dynamic = "force-dynamic";

/**
 * Booking Engine → Extras. The PMS's own `PosItem` rows, not a second list — so what a guest adds
 * here is what the front desk posts. Inactive ones are hidden rather than deleted, because folio
 * lines from past stays still reference what a guest bought.
 */
export default async function BookingEngineExtras() {
  const { property } = await bookingEnginePage();
  const extras: EditableExtra[] = await prisma.posItem.findMany({
    where: { propertyId: property.id, category: "extra", active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, priceMinor: true, basis: true, directSellable: true },
  });
  return (
    <Card>
      <CardHeader
        title="Extras you sell"
        subtitle="Offered after a guest has picked a room, added to the same bill, and posted by your front desk from this same list."
      />
      <div className="px-5 py-4">
        <ExtrasEditor extras={extras} currency={property.baseCurrency} />
      </div>
    </Card>
  );
}
