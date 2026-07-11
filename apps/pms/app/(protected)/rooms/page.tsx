import { Card, PageHeader } from "@/components/ui/primitives";
import { getRoomsBoard } from "@/lib/data";
import { RoomsManager } from "@/components/rooms/RoomsManager";
import type { HkStatus } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const { property, roomTypes } = await getRoomsBoard();

  const data = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    code: rt.code,
    totalRooms: rt.totalRooms,
    unitKind: rt.unitKind,
    units: rt.units.map((u) => ({
      id: u.id, label: u.label, floor: u.floor, hkStatus: u.hkStatus as HkStatus,
      features: u.features, connectingUnitIds: u.connectingUnitIds,
    })),
  }));

  // Flat list of every unit (for the connecting-room picker) — connections can cross room types.
  const allUnits = data.flatMap((rt) => rt.units.map((u) => ({ id: u.id, label: u.label })));
  const totalUnits = allUnits.length;

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle={`${property.name} · ${totalUnits} physical room${totalUnits === 1 ? "" : "s"} across ${data.length} room type${data.length === 1 ? "" : "s"}`}
      />

      {data.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">No room types on this property</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink-500">
            Room types are defined in RevioLink / RevioCRS (Rooms &amp; Rates). Once a property has room types, add the individual physical rooms here.
          </p>
        </Card>
      ) : (
        <RoomsManager roomTypes={data} allUnits={allUnits} blocked={blocked} />
      )}
    </div>
  );
}
