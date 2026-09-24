import { orderFloors } from "@/lib/floor-order";
import { fill } from "@revio/ui/i18n";
import Link from "next/link";
import { User, TriangleAlert, ListOrdered, LayoutGrid, Clock, LogIn, LogOut } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getHousekeepingUnits, statusCounts, type UnitRow } from "@/lib/data";
import { StatusControl } from "@/components/housekeeping/StatusControl";
import { RoomActions } from "@/components/housekeeping/RoomActions";
import { HK_TILE, HK_STATUSES, type HkStatus } from "@/lib/hk-meta";
import { getSession } from "@/lib/session";
import { getOpenShift, getActiveCleanerCount } from "@/lib/workforce";
import { clockInSelf, clockOutSelf } from "@/lib/actions-workforce";
import { translate } from "@revio/ui/i18n";
import { housekeeping, type HousekeepingStrings } from "@/lib/i18n/housekeeping";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

const COUNT_DOT: Record<HkStatus, string> = {
  clean: "bg-success-500",
  dirty: "bg-warning-500",
  in_progress: "bg-brand-500",
  inspected: "bg-accent-500",
  out_of_order: "bg-danger-500",
};

const REASON_TINT: Record<string, string> = {
  "Turn for arrival": "bg-danger-100 text-danger-700",
  "Arrival today": "bg-warning-100 text-warning-700",
  "Departure": "bg-accent-100 text-accent-700",
  "Stayover": "bg-brand-100 text-brand-700",
  "No arrival pressure": "bg-ink-100 text-ink-500",
};

function RoomTile({ u, t }: { u: UnitRow; t: HousekeepingStrings }) {
  return (
    <div className={`rounded-lg border p-3 ${HK_TILE[u.hkStatus]}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[16px] font-bold tracking-tight text-ink-900">{u.label}</span>
        <span className="truncate pl-2 text-[10.5px] font-medium text-ink-500">{u.roomTypeName}</span>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10.5px] leading-tight">
        {u.occupied ? (
          <>
            <User className="h-3 w-3 shrink-0 text-brand-700" />
            <span className="truncate font-semibold text-brand-700">{u.guestName ?? t.occupied}</span>
            {u.dueOutToday && <span className="rounded bg-warning-100 px-1 text-[9px] font-bold text-warning-700">{t.dueOut}</span>}
          </>
        ) : (
          <span className="text-ink-400">{t.vacant}</span>
        )}
      </div>
      {u.cleanReason && (
        <div className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${REASON_TINT[u.cleanReason] ?? "bg-ink-100 text-ink-500"}`}>
          {t.reasons[u.cleanReason] ?? u.cleanReason}
        </div>
      )}
      <div className="mt-2">
        <StatusControl unitId={u.id} status={u.hkStatus} labels={t.statuses} aria={t.actions.statusAria} />
      </div>
      <RoomActions unitId={u.id} status={u.hkStatus} t={t.actions} />
    </div>
  );
}

/** A key, not a label — the heading is translated where it is drawn. */
const UNASSIGNED = "\u0000unassigned";

const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export default async function HousekeepingPage({ searchParams }: { searchParams: Promise<{ view?: string; blocked?: string }> }) {
  const { view, blocked } = await searchParams;
  const session = await getSession();
  const t = translate(housekeeping, await getLocale());
  const [{ property, units }, openShift, activeCleaners] = await Promise.all([
    getHousekeepingUnits(),
    session ? getOpenShift(session.userId) : Promise.resolve(null),
    getActiveCleanerCount(),
  ]);
  const counts = statusCounts(units);
  const smart = view !== "floor"; // smart routing is the default

  // Floor grouping (units without a floor go under "Unassigned").
  const byFloor = new Map<string, UnitRow[]>();
  for (const u of units) {
    const key = u.floor?.trim() || UNASSIGNED;
    (byFloor.get(key) ?? byFloor.set(key, []).get(key)!).push(u);
  }
  // The hotel's own floor order (Rooms → Floors), the same one the calendar uses; no floor goes last.
  const floors = [
    ...orderFloors([...byFloor.keys()].filter((k) => k !== UNASSIGNED), property.floorOrder),
    ...(byFloor.has(UNASSIGNED) ? [UNASSIGNED] : []),
  ];

  // Smart order: the cleaning queue (dirty / in-progress) first, by priority, then the rest.
  const queue = units.filter((u) => u.cleanReason).sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const rest = units.filter((u) => !u.cleanReason).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const toggleCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${active ? "bg-brand-800 text-white" : "border border-surface-border bg-white text-ink-600 hover:bg-surface-muted"}`;

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(property.name, units.length)}
        action={
          <div className="flex items-center gap-1.5">
            <Link href="/housekeeping?view=smart" className={toggleCls(smart)}><ListOrdered className="h-3.5 w-3.5" /> {t.smartOrder}</Link>
            <Link href="/housekeeping?view=floor" className={toggleCls(!smart)}><LayoutGrid className="h-3.5 w-3.5" /> {t.byFloor}</Link>
          </div>
        }
      />

      {/* Clock-in / active workforce (§6.7): only clocked-in cleaners receive assignments; the active
          count feeds feasibility (rooms-to-clean vs cleaners). Availability + light KPI, not payroll. */}
      <Card surface="flat" className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Clock className="h-4 w-4 text-ink-400" />
          {openShift ? (
            <span className="font-semibold text-success-700">{t.clockedInSince(openShift.clockInAt.toISOString().slice(11, 16))}</span>
          ) : (
            <span className="text-ink-500">{t.notClockedIn}</span>
          )}
          <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{t.active(activeCleaners)}</span>
        </div>
        {openShift ? (
          <form action={clockOutSelf}>
            <button className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"><LogOut className="h-3.5 w-3.5" /> {t.clockOut}</button>
          </form>
        ) : (
          <form action={clockInSelf}>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-500"><LogIn className="h-3.5 w-3.5" /> {t.clockIn}</button>
          </form>
        )}
      </Card>

      {blocked && (
        <Card surface="flat" className="mb-4 border-danger-500/50 bg-danger-50 p-3.5">
          <div className="flex items-start gap-2.5 text-[13px] text-ink-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
            <span><span className="font-semibold text-danger-700">{t.blockedLead}</span> {t.blockedBody(blocked)}</span>
          </div>
        </Card>
      )}

      {units.length === 0 ? (
        <Card surface="flat" className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">{t.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            {t.emptyBefore} <Link href="/rooms" className="font-semibold text-accent-600 underline">{t.emptyLink}</Link> {t.emptyAfter}
          </p>
        </Card>
      ) : (
        <>
          {/* Status summary */}
          <div className="mb-5 flex flex-wrap gap-2">
            {HK_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700">
                <span className={`h-2 w-2 rounded-full ${COUNT_DOT[s]}`} />
                {t.statuses[s]}
                <span className="tnum text-ink-900">{counts[s]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-800/20 bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand-700">
              <User className="h-3 w-3" /> {t.occupied}
              <span className="tnum">{units.filter((u) => u.occupied).length}</span>
            </span>
          </div>

          {smart ? (
            <div className="space-y-5">
              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  <ListOrdered className="h-3.5 w-3.5" /> {t.queueHeading(queue.length)}
                </h2>
                {queue.length === 0 ? (
                  <Card surface="flat" className="p-5 text-center text-[13px] text-ink-400">{t.queueEmpty}</Card>
                ) : (
                  <div className={GRID}>{queue.map((u) => <RoomTile key={u.id} u={u} t={t} />)}</div>
                )}
              </section>
              {rest.length > 0 && (
                <section>
                  <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">{t.restHeading(rest.length)}</h2>
                  <div className={GRID}>{rest.map((u) => <RoomTile key={u.id} u={u} t={t} />)}</div>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {floors.map((floor) => (
                <section key={floor}>
                  <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">{floor === UNASSIGNED ? t.unassignedFloor : /^\d+$/.test(floor) ? fill(t.numberedFloor, { floor }) : floor}</h2>
                  <div className={GRID}>{byFloor.get(floor)!.map((u) => <RoomTile key={u.id} u={u} t={t} />)}</div>
                </section>
              ))}
            </div>
          )}

          <p className="mt-5 text-[11.5px] text-ink-400">
            {t.footnoteLead}{" "}
            <span className="font-semibold text-danger-600">{t.footnoteOoo}</span> {t.footnoteTail}
          </p>
        </>
      )}
    </div>
  );
}
