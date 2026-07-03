import { CalendarOff } from "lucide-react";
import { getSetupData } from "@/lib/data";
import { deleteInventoryPeriod } from "@/lib/actions-inventory";
import { PeriodDialog } from "@/components/inventory/PeriodDialog";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function InventorySetupPage() {
  const { property, roomTypes, periods, todayIso } = await getSetupData();
  const active = (p: (typeof periods)[number]) =>
    p.dateTo.toISOString().slice(0, 10) >= todayIso;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory Setup"
        subtitle={`${property.name} · physical counts and date-sensitive out-of-order / closure periods`}
        action={<PeriodDialog roomTypes={roomTypes.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, totalRooms: r.totalRooms }))} todayIso={todayIso} />}
      />

      <Card>
        <CardHeader title="Room types & physical counts" />
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-4 py-2.5">Room type</th>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Unit</th>
              <th className="px-4 py-2.5 text-right">Physical count</th>
              <th className="px-4 py-2.5 text-right">Max guests</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => (
              <tr key={rt.id} className="border-b border-surface-border/60 last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink-900">{rt.name}</td>
                <td className="tnum px-4 py-2.5 text-ink-500">{rt.code}</td>
                <td className="px-4 py-2.5 text-ink-500">{rt.unitKind}</td>
                <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{rt.totalRooms}</td>
                <td className="tnum px-4 py-2.5 text-right text-ink-500">{rt.maxGuests}</td>
                <td className="px-4 py-2.5"><StatusPill tone={rt.active ? "success" : "neutral"}>{rt.active ? "active" : "inactive"}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          The physical count is the permanent total. Room types themselves are managed in RevioLink → Rooms &amp; Rates —
          both products read the same records.
        </p>
      </Card>

      {periods.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="h-7 w-7" />}
          title="No out-of-order or closure periods"
          body="When rooms go under maintenance or a wing closes for the season, add a period here — availability drops for exactly those dates and restores itself after."
        />
      ) : (
        <Card>
          <CardHeader title="Out-of-order & closure periods" />
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Room type</th>
                <th className="px-4 py-2.5">Kind</th>
                <th className="px-4 py-2.5">From</th>
                <th className="px-4 py-2.5">To</th>
                <th className="px-4 py-2.5 text-right">Units</th>
                <th className="px-4 py-2.5">Note</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{p.roomType.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={p.kind === "closure" ? "info" : "warning"}>
                      {p.kind === "closure" ? "closure" : "out of order"}
                    </StatusPill>
                  </td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{p.dateFrom.toISOString().slice(0, 10)}</td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{p.dateTo.toISOString().slice(0, 10)}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{p.rooms}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-ink-500">{p.note ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={active(p) ? "success" : "neutral"}>{active(p) ? "current" : "past"}</StatusPill>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DeleteButton action={deleteInventoryPeriod} id={p.id} label={`${p.roomType.name} ${p.kind === "closure" ? "closure" : "out-of-order"} period`} note="Availability for these dates restores immediately." />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
