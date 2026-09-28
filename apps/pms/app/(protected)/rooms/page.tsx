import { Card, PageHeader } from "@/components/ui/primitives";
import { getRoomsBoard } from "@/lib/data";
import { RoomsManager } from "@/components/rooms/RoomsManager";
import type { HkStatus } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { template } from "@revio/ui/i18n";
import { rooms } from "@/lib/i18n/rooms";
import { common } from "@/lib/i18n/common";
import { orderFloors } from "@/lib/floor-order";
import { fill } from "@revio/ui/i18n";
import { roomRulesStrings } from "@revio/ui/room-rules-strings";
import { getSession } from "@/lib/session";
import { roomTypesOwner } from "@/lib/unit-plan";
import { roleHasCapability } from "@/lib/roles";
import { RoomTypesEditor } from "@/components/rooms/RoomTypesEditor";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const { blocked } = await searchParams;
  const { property, roomTypes } = await getRoomsBoard();
  const { t } = await i18n();
  const s = t(rooms);
  const c = t(common);
  const r = t(roomRulesStrings);
  const session = await getSession();
  // Who owns the room types' counts: RevioPMS itself when it runs alone, otherwise the product that
  // sells them — and a hotel is told which, rather than sent to a product it does not have.
  const owner = session ? roomTypesOwner(session.entitlements) : null;
  const canEditTypes = !owner && !!session && roleHasCapability(session.role, "manage");

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

      {canEditTypes ? (
        <RoomTypesEditor
          rows={roomTypes.map((rt) => ({ id: rt.id, name: rt.name, totalRooms: rt.totalRooms, maxGuests: rt.maxGuests, active: rt.active }))}
          t={{
            ...r.editor,
            removeConfirm: Object.fromEntries(roomTypes.map((rt) => [rt.id, fill(r.editor.removeConfirm, { name: rt.name })])),
          }}
        />
      ) : owner && data.length > 0 ? (
        <p className="mb-4 text-[12.5px] text-ink-500">{fill(r.editor.managedIn, { product: owner })}</p>
      ) : null}

      {data.length === 0 ? (
        canEditTypes ? null : (
          <Card className="p-8 text-center">
            <p className="text-[14px] font-semibold text-ink-900">{s.noTypes}</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink-500">
              {owner ? fill(r.editor.managedIn, { product: owner }) : s.noTypesBody}
            </p>
          </Card>
        )
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
