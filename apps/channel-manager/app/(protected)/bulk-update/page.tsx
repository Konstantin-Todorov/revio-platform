import { getRoomsAndRates } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { BulkUpdateForm } from "@/components/bulk/BulkUpdateForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { roomTypes } = await getRoomsAndRates();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="Bulk Update" subtitle="Change rates, availability and restrictions across many dates and rooms at once" />
      <BulkUpdateForm roomTypes={roomTypes.map((r) => ({ id: r.id, name: r.name, code: r.code }))} today={today} />
    </div>
  );
}
