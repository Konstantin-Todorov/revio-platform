import { Card, PageHeader } from "@/components/ui/primitives";
import { getRoomsBoard } from "@/lib/data";
import { RoomsManager } from "@/components/rooms/RoomsManager";
import type { HkStatus } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { template } from "@revio/ui/i18n";
import { rooms } from "@/lib/i18n/rooms";
import { common } from "@/lib/i18n/common";
import { orderFloors } from "@/lib/floor-order";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const { property, roomTypes } = await getRoomsBoard();
  const { t } = await i18n();
  const s = t(rooms);
  const c = t(common);

  const data = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    code: rt.code,
    totalRooms: rt.totalRooms,
    unitKind: rt.unitKind,
    // Worded here: the plural depends on the count, and a client component takes no functions.
    summary: `${s.created(rt.units.length, rt.unitKind === "bed")} ${s.cap(rt.totalRooms)}`,
    units: rt.units.map((u) => ({
      id: u.id, label: u.label, floor: u.floor, hkStatus: u.hkStatus as HkStatus,
      features: u.features, connectingUnitIds: u.connectingUnitIds,
    })),
  }));

  // Flat list of every unit (for the connecting-room picker) — connections can cross room types.
  const allUnits = data.flatMap((rt) => rt.units.map((u) => ({ id: u.id, label: u.label })));
  const totalUnits = allUnits.length;
  const floorOrder = orderFloors(data.flatMap((rt) => rt.units.map((u) => u.floor ?? "")), property.floorOrder);

  return (
    <div>
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name, totalUnits, data.length)}
      />

      {data.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">{s.noTypes}</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink-500">
            {s.noTypesBody}
          </p>
        </Card>
      ) : (
        <RoomsManager
          roomTypes={data} allUnits={allUnits} floorOrder={floorOrder} blocked={blocked} statuses={c.statuses}
          t={{
            // Named one by one: spreading the dictionary would carry its functions across to the
            // client component, which Next refuses — the page fails.
            blockedBody: s.blockedBody, over: s.over, addRooms: s.addRooms, noRooms: s.noRooms,
            historyTitle: s.historyTitle, roomName: s.roomName, floor: s.floor, floorPlaceholder: s.floorPlaceholder,
            roomPlaceholder: s.roomPlaceholder, features: s.features, featureLabels: s.featureLabels,
            connecting: s.connecting, connectingNote: s.connectingNote, saveAttributes: s.saveAttributes,
            cancel: s.cancel, adding: s.adding, addOne: s.addOne, prefix: s.prefix, none: s.none, start: s.start,
            howMany: s.howMany, generating: s.generating, generate: s.generate, generateNote: s.generateNote,
            blocked: template(s.blocked, "room"), historyAria: template(s.historyAria, "room"),
            editAria: template(s.editAria, "room"), deleteAria: template(s.deleteAria, "room"),
            deleteConfirm: template(s.deleteConfirm, "room"), connected: template(s.connected, "rooms"),
            floors: s.floors,
          }}
        />
      )}
    </div>
  );
}
