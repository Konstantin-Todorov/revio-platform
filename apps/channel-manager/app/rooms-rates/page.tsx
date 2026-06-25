import { getRoomsAndRates } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

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

  return (
    <div>
      <PageHeader title="Rooms & Rates" subtitle="What you sell — room types and the rate plans priced against them" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Room Types" action={<span className="text-[12px] font-semibold text-ink-400">{roomTypes.length} types</span>} />
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Room Type", "Code", "Kind", "Inventory", "Max", "Status"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{rt.name}</td>
                  <td className="px-4 py-2.5 text-ink-500">{rt.code}</td>
                  <td className="px-4 py-2.5 text-ink-600">{KIND_LABEL[rt.unitKind] ?? rt.unitKind}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{rt.totalInventory}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{rt.maxGuests}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={rt.active ? "success" : "neutral"}>{rt.active ? "Active" : "Inactive"}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Rate Plans" action={<span className="text-[12px] font-semibold text-ink-400">{ratePlans.length} plans</span>} />
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Rate Plan", "Type", "Pricing", "Tags"].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((rp) => (
                <tr key={rp.id} className="border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink-900">{rp.name}</div>
                    <div className="text-[11px] text-ink-400">{rp.code} · {rp._count.roomTypeLinks} rooms · {rp.mealPlan?.name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={rp.priceLogic === "derived" ? "info" : "neutral"}>{rp.priceLogic}</StatusPill>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-600">{derivedLabel(rp) ?? "Manual entry"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {rp.tags.map((tg) => (
                        <span key={tg} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-500">{tg}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
