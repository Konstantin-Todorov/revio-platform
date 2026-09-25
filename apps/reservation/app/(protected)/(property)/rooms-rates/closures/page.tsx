import { CalendarOff } from "lucide-react";
import { getSetupData } from "@/lib/data";
import { deleteInventoryPeriod } from "@/lib/actions-inventory";
import { PeriodDialog } from "@/components/inventory/PeriodDialog";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { i18n } from "@/lib/i18n/server";
import { rates as ratesDict } from "@/lib/i18n/rates";

export const dynamic = "force-dynamic";

/** Out-of-order & closure periods. Rooms taken out of order in RevioPMS show here too. */
export default async function ClosuresPage() {
  const { roomTypes, periods, todayIso } = await getSetupData();
  const { t, day } = await i18n();
  const s = t(ratesDict).closures;
  const activePeriod = (p: (typeof periods)[number]) => p.dateTo.toISOString().slice(0, 10) >= todayIso;

  return (
    <Card surface="flat">
      <CardHeader surface="flat"
        title={s.title}
        subtitle={s.subtitle}
        action={<PeriodDialog roomTypes={roomTypes.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, totalRooms: r.totalRooms }))} todayIso={todayIso} />}
      />
      {periods.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-5 text-[13px] text-ink-500">
          <CalendarOff className="h-4 w-4" /> {s.empty}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {[s.cols.roomType, s.cols.kind, s.cols.from, s.cols.to, s.cols.units, s.cols.note, s.cols.status].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{p.roomType.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={p.kind === "closure" ? "info" : "warning"}>{p.kind === "closure" ? s.closure : s.outOfOrder}</StatusPill>
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{day(p.dateFrom.toISOString().slice(0, 10))}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{day(p.dateTo.toISOString().slice(0, 10))}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{p.rooms}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-500">{p.note ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={activePeriod(p) ? "success" : "neutral"}>{activePeriod(p) ? s.current : s.past}</StatusPill></td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteButton action={deleteInventoryPeriod} id={p.id} label={s.deleteLabel(p.roomType.name, p.kind === "closure" ? "closure" : "out_of_order")} note={s.deleteNote} />
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
