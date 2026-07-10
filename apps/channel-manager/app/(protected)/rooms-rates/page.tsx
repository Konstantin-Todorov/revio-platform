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

function restrictionLabel(rp: { defMinLos: number | null; defMaxLos: number | null; defAdvancePurchaseMin: number | null; defAdvancePurchaseMax: number | null }) {
  const parts: string[] = [];
  if (rp.defMinLos) parts.push(`min ${rp.defMinLos}n`);
  if (rp.defMaxLos) parts.push(`max ${rp.defMaxLos}n`);
  if (rp.defAdvancePurchaseMin != null) parts.push(`book ≥${rp.defAdvancePurchaseMin}d ahead`);
  if (rp.defAdvancePurchaseMax != null) parts.push(`book ≤${rp.defAdvancePurchaseMax}d ahead`);
  return parts.length ? parts.join(" · ") : null;
}

export default async function RoomsRatesPage({ searchParams }: { searchParams: Promise<{ blocked?: string; kind?: string }> }) {
  const { blocked, kind } = await searchParams;
  const { roomTypes, ratePlans } = await getRoomsAndRates();
  const parents = ratePlans.map((rp) => ({ id: rp.id, name: rp.name }));

  // Rate Plan Linkage (CM-UPDATES-V1): derivation chains as a graphical overview — roots are
  // manual plans, children hang off parentRatePlanId with their offset.
  const childrenOf = (parentId: string) => ratePlans.filter((rp) => rp.parentRatePlanId === parentId);
  const offsetOf = (rp: (typeof ratePlans)[number]) => {
    const sign = rp.derivedDirection === "increase" ? "+" : "−";
    return rp.derivedType === "percent" ? `${sign}${rp.derivedValue}%` : `${sign}€${((rp.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
  };
  const roots = ratePlans.filter((rp) => rp.priceLogic === "manual");

  return (
    <div>
      <PageHeader title="Rooms & Rates" subtitle="What you sell — add, edit and remove room types and rate plans" />

      {blocked && (
        <div className="mb-4 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
          “{blocked}” is mapped to a channel and can’t be deleted — remove its {kind === "room" ? "room-type" : "rate-plan"} mapping
          in <a href="/mapping" className="font-semibold underline">Mapping</a> first, then delete it here.
        </div>
      )}

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
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">
                    {derivedLabel(rp) ?? "Manual entry"}
                    {restrictionLabel(rp) && <div className="mt-0.5 text-[10.5px] text-ink-400">{restrictionLabel(rp)}</div>}
                  </td>
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

      {/* Rate Plan Linkage (CM-UPDATES-V1): the derivation graph — who derives from whom, at what
          offset. Derivation itself is configured on each plan (edit → Derived pricing). */}
      <Card className="mt-4">
        <CardHeader title="Rate Plan Linkage" subtitle="Derived-pricing chains — edit a parent and every child recalculates" />
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-3">
          {roots.map((root) => {
            const kids = childrenOf(root.id);
            return (
              <div key={root.id}>
                <div className="inline-flex items-center gap-2 rounded-md border border-brand-600/30 bg-brand-50 px-3 py-1.5 text-[13px] font-bold text-brand-800">
                  {root.name}
                  <span className="rounded bg-white px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-700">manual</span>
                </div>
                {kids.length === 0 && <div className="mt-1.5 pl-4 text-[11.5px] text-ink-400">No derived rates yet.</div>}
                {kids.map((kid) => {
                  const grandkids = childrenOf(kid.id);
                  return (
                    <div key={kid.id} className="mt-1.5 pl-4">
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span className="text-ink-300">↓</span>
                        <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{offsetOf(kid)}</span>
                        <span className={`font-semibold ${kid.active ? "text-ink-800" : "text-ink-400 line-through"}`}>{kid.name}</span>
                        {!kid.directChannelEnabled && <span title="Not bookable on the direct channel" className="rounded bg-surface-sunken px-1 py-0.5 text-[9px] font-bold uppercase text-ink-400">OTA/corp</span>}
                      </div>
                      {grandkids.map((g) => (
                        <div key={g.id} className="mt-1 flex items-center gap-2 pl-6 text-[12.5px]">
                          <span className="text-ink-300">↓</span>
                          <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">{offsetOf(g)}</span>
                          <span className={`font-semibold ${g.active ? "text-ink-800" : "text-ink-400 line-through"}`}>{g.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {roots.length === 0 && <p className="text-[13px] text-ink-400">Add a manual rate plan first — derived plans hang off it.</p>}
        </div>
      </Card>

      <p className="mt-3 text-[12px] text-ink-400">
        Every change is written through <span className="font-semibold text-ink-500">@revio/core</span>, recorded in the
        Audit Log, and pushed to connected channels (mock) — visible in the Sync Center.
      </p>
    </div>
  );
}
