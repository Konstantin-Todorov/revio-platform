import { CalendarOff } from "lucide-react";
import { getSetupData } from "@/lib/data";
import { deleteInventoryPeriod } from "@/lib/actions-inventory";
import { PeriodDialog } from "@/components/inventory/PeriodDialog";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = "force-dynamic";

/** Out-of-order & closure periods. Rooms taken out of order in RevioPMS show here too. */
export default async function ClosuresPage() {
  const { roomTypes, periods, todayIso } = await getSetupData();
  const activePeriod = (p: (typeof periods)[number]) => p.dateTo.toISOString().slice(0, 10) >= todayIso;

  return (
    <Card surface="flat">
      <CardHeader surface="flat"
        title="Out-of-order & closure periods"
        subtitle="Close rooms for sale here. Rooms taken out of order come from RevioPMS."
        action={<PeriodDialog roomTypes={roomTypes.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, totalRooms: r.totalRooms }))} todayIso={todayIso} />}
      />
      {periods.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-5 text-[13px] text-ink-500">
          <CalendarOff className="h-4 w-4" /> Nothing closed — add a closure when rooms go under maintenance or a wing shuts for the season.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Room type", "Kind", "From", "To", "Units", "Note", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{p.roomType.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={p.kind === "closure" ? "info" : "warning"}>{p.kind === "closure" ? "closure" : "out of order"}</StatusPill>
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{p.dateFrom.toISOString().slice(0, 10)}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{p.dateTo.toISOString().slice(0, 10)}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{p.rooms}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-500">{p.note ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={activePeriod(p) ? "success" : "neutral"}>{activePeriod(p) ? "current" : "past"}</StatusPill></td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteButton action={deleteInventoryPeriod} id={p.id} label={`${p.roomType.name} ${p.kind === "closure" ? "closure" : "out-of-order"} period`} note="Availability for these dates restores immediately." />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
