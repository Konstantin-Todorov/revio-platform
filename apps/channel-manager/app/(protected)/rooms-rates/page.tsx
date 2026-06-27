import { getRoomsAndRates } from "@/lib/data";
import { deleteRatePlan, deleteRoomType } from "@/lib/actions";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { RoomTypeDialog } from "@/components/rooms/RoomTypeDialog";
import { RatePlanDialog } from "@/components/rooms/RatePlanDialog";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { room: "Room", bed: "Bed (hostel)", apartment: "Apartment" };

function derivedLabel(rp: { derivedType: string | null; derivedDirection: string | null; derivedValue: number | null; parent: { name: string } | null }) {
  if (!rp.derivedType) return null;
  const sign = rp.derivedDirection === "increase" ? "+" : "−";
  const amount = rp.derivedType === "percent" ? `${rp.derivedValue}%` : `€${(rp.derivedValue ?? 0) / 100}`;
  return `${rp.parent?.name ?? "parent"} ${sign}${amount}`;
}

export default async function RoomsRatesPage() {
  const { roomTypes, ratePlans } = await getRoomsAndRates();
  const parents = ratePlans.map((rp) => ({ id: rp.id, name: rp.name }));

  return (
    <div>
      <PageHeader title="Rooms & Rates" subtitle="What you sell — add, edit and remove room types and rate plans" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Room Types" action={<RoomTypeDialog />} />
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Room Type", "Code", "Kind", "Inv.", "Max", "Status"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{rt.name}</td>
                  <td className="px-4 py-2.5 text-ink-500">{rt.code}</td>
                  <td className="px-4 py-2.5 text-ink-600">{KIND_LABEL[rt.unitKind] ?? rt.unitKind}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{rt.totalRooms}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{rt.maxGuests}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={rt.active ? "success" : "neutral"}>{rt.active ? "Active" : "Inactive"}</StatusPill></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RoomTypeDialog roomType={rt} />
                      <DeleteButton action={deleteRoomType} id={rt.id} label={rt.name} note="If it has reservations it is deactivated instead." />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Rate Plans" action={<RatePlanDialog parents={parents} />} />
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Rate Plan", "Type", "Pricing", "Tags"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((rp) => (
                <tr key={rp.id} className="group border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink-900">{rp.name}{!rp.active && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">inactive</span>}</div>
                    <div className="text-[11px] text-ink-400">{rp.code} · {rp._count.roomTypeLinks} rooms · {rp.mealPlan?.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={rp.priceLogic === "derived" ? "info" : "neutral"}>{rp.priceLogic}</StatusPill></td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{derivedLabel(rp) ?? "Manual entry"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {rp.tags.map((tg) => <span key={tg} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-500">{tg}</span>)}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <RatePlanDialog ratePlan={rp} parents={parents.filter((p) => p.id !== rp.id)} />
                      <DeleteButton action={deleteRatePlan} id={rp.id} label={rp.name} note="Parents of derived rates are deactivated instead." />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <p className="mt-3 text-[12px] text-ink-400">
        Every change is written through <span className="font-semibold text-ink-500">@revio/core</span>, recorded in the
        Audit Log, and pushed to connected channels (mock) — visible in the Sync Center.
      </p>
    </div>
  );
}
