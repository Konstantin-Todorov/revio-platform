import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getHousekeepingUnits, statusCounts, type UnitRow } from "@/lib/data";
import { StatusControl } from "@/components/housekeeping/StatusControl";
import { HK_LABEL, HK_TILE, HK_STATUSES, type HkStatus } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

const COUNT_DOT: Record<HkStatus, string> = {
  clean: "bg-success-500",
  dirty: "bg-warning-500",
  inspected: "bg-accent-500",
  out_of_order: "bg-danger-500",
};

export default async function HousekeepingPage() {
  const { property, units } = await getHousekeepingUnits();
  const counts = statusCounts(units);

  // Group by floor (units without a floor go under "Unassigned").
  const byFloor = new Map<string, UnitRow[]>();
  for (const u of units) {
    const key = u.floor?.trim() || "Unassigned";
    (byFloor.get(key) ?? byFloor.set(key, []).get(key)!).push(u);
  }
  const floors = [...byFloor.keys()].sort((a, b) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b, undefined, { numeric: true }),
  );

  return (
    <div>
      <PageHeader
        title="Housekeeping"
        subtitle={`${property.name} · ${units.length} room${units.length === 1 ? "" : "s"} · tap a status to update`}
      />

      {units.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">No rooms to clean yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            Add your physical rooms in <Link href="/rooms" className="font-semibold text-accent-600 underline">Rooms</Link> and they’ll appear here for the housekeeping team.
          </p>
        </Card>
      ) : (
        <>
          {/* Status summary */}
          <div className="mb-5 flex flex-wrap gap-2">
            {HK_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700">
                <span className={`h-2 w-2 rounded-full ${COUNT_DOT[s]}`} />
                {HK_LABEL[s]}
                <span className="tnum text-ink-900">{counts[s]}</span>
              </span>
            ))}
          </div>

          {/* Board grouped by floor */}
          <div className="space-y-5">
            {floors.map((floor) => (
              <section key={floor}>
                <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">{floor}</h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {byFloor.get(floor)!.map((u) => (
                    <div key={u.id} className={`rounded-lg border p-3 ${HK_TILE[u.hkStatus]}`}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[16px] font-bold tracking-tight text-ink-900">{u.label}</span>
                        <span className="truncate pl-2 text-[10.5px] font-medium text-ink-500">{u.roomTypeName}</span>
                      </div>
                      <div className="mt-2">
                        <StatusControl unitId={u.id} status={u.hkStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-5 text-[11.5px] text-ink-400">
            Marking a room <span className="font-semibold text-danger-600">Out of order</span> takes it off sale on every
            channel (via the shared availability waterfall) until it’s back in service. Occupied/vacant overlay arrives in Phase 2.
          </p>
        </>
      )}
    </div>
  );
}
