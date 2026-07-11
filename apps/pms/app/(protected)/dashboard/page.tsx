import Link from "next/link";
import { BedDouble, Sparkles, Wrench, CircleCheck, LogIn, LogOut, Users, ArrowRightLeft, UserPlus, DoorOpen, Receipt, AlertTriangle } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getFrontDeskOverview, type StayRow } from "@/lib/data";
import { checkOut } from "@/lib/actions-frontdesk";
import { HK_LABEL, HK_TONE } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

// Room-ready indicator on an arrival (spec §3.1): can reception check them in now, or is housekeeping
// still the blocker? Reflects the live pool of clean/inspected rooms of the arrival's room type.
const READY: Record<"ready" | "partial" | "none", { tone: "success" | "warning" | "danger"; label: string }> = {
  ready: { tone: "success", label: "Room ready" },
  partial: { tone: "warning", label: "Partly ready" },
  none: { tone: "danger", label: "Awaiting housekeeping" },
};

/** The assigned physical room(s) + their housekeeping state, shown on in-house / departure rows. */
function AssignedRooms({ row }: { row: StayRow }) {
  if (row.assignedUnits.length === 0) return <span className="text-ink-400">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.assignedUnits.map((u) => (
        <span key={u.unitId} className="inline-flex items-center gap-1">
          <span className="font-semibold text-accent-600">{u.unitLabel}</span>
          <StatusPill tone={HK_TONE[u.hkStatus]}>{HK_LABEL[u.hkStatus]}</StatusPill>
        </span>
      ))}
    </span>
  );
}

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function prettyDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MO[(m ?? 1) - 1]} ${y}`;
}

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof BedDouble; label: string; value: number; tint: string }) {
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tracking-tight text-ink-900 tnum">{value}</div>
          <div className="mt-1 text-[12px] font-medium text-ink-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function meta(r: StayRow) {
  return `${r.roomLabel} · ${r.nights} night${r.nights === 1 ? "" : "s"}`;
}

export default async function DashboardPage() {
  const { property, today, counts, totalUnits, arrivals, inHouse, departures, departedToday, dueOutCount, conflicts } = await getFrontDeskOverview();

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle={`${property.name} · ${prettyDate(today)} (property time)`}
        action={
          <Link href="/walkin" className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-500">
            <UserPlus className="h-4 w-4" /> Walk-in
          </Link>
        }
      />

      {totalUnits === 0 && (
        <Card className="mb-5 border-accent-500/40 bg-accent-50 p-4">
          <div className="flex items-start gap-3">
            <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
            <div className="text-[13px] text-ink-700">
              <span className="font-semibold text-ink-900">No rooms set up yet.</span> Add your physical rooms in{" "}
              <Link href="/rooms" className="font-semibold text-accent-600 underline">Rooms</Link> to start checking guests in.
            </div>
          </div>
        </Card>
      )}

      {/* Double-assignment warning (spec §3.1) — reception must never silently leave two guests in one room. */}
      {conflicts.length > 0 && (
        <Card className="mb-5 border-danger-500/50 bg-danger-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
            <div className="text-[13px] text-ink-700">
              <span className="font-semibold text-danger-700">Room assignment conflict.</span> The same physical room holds more than one in-house guest — resolve with a room move:
              <ul className="mt-1.5 space-y-0.5">
                {conflicts.map((c) => (
                  <li key={c.unitLabel} className="text-[12.5px]">
                    <span className="font-semibold text-ink-900">Room {c.unitLabel}</span> — {c.guests.join(" & ")}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Housekeeping status summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={BedDouble} label="Rooms" value={totalUnits} tint="bg-brand-50 text-brand-600" />
        <StatCard icon={CircleCheck} label={HK_LABEL.clean} value={counts.clean} tint="bg-success-50 text-success-600" />
        <StatCard icon={Sparkles} label={HK_LABEL.dirty} value={counts.dirty} tint="bg-warning-50 text-warning-600" />
        <StatCard icon={CircleCheck} label={HK_LABEL.inspected} value={counts.inspected} tint="bg-accent-50 text-accent-600" />
        <StatCard icon={Wrench} label={HK_LABEL.out_of_order} value={counts.out_of_order} tint="bg-danger-50 text-danger-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Arrivals — to check in */}
        <Card>
          <CardHeader title="Arrivals — to check in" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogIn className="h-3.5 w-3.5" />{arrivals.length}</span>} />
          {arrivals.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12.5px] text-ink-400">No one left to check in today.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {arrivals.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.overdue && <StatusPill tone="danger">Overdue</StatusPill>}
                      {r.roomReady && <StatusPill tone={READY[r.roomReady].tone}>{READY[r.roomReady].label}</StatusPill>}
                    </div>
                    <div className="text-[11.5px] text-ink-500">{meta(r)}</div>
                  </div>
                  <Link href={`/checkin/${r.reservationId}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-800 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700">
                    <LogIn className="h-3.5 w-3.5" /> Check in
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* In house */}
        <Card>
          <CardHeader title="In house" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><Users className="h-3.5 w-3.5" />{inHouse.length}{dueOutCount > 0 && <span className="ml-1 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-600">{dueOutCount} due out</span>}</span>} />
          {inHouse.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12.5px] text-ink-400">No one in house tonight.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {inHouse.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.dueOutToday && <StatusPill tone="warning">Due out</StatusPill>}
                      {r.conflict && <StatusPill tone="danger">Room conflict</StatusPill>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
                      <DoorOpen className="h-3 w-3 text-accent-500" />
                      <AssignedRooms row={r} />
                      <span>· {meta(r)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={`/folio/${r.reservationId}`} aria-label="Folio" title="Folio / bill" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                      <Receipt className="h-3.5 w-3.5" />
                    </Link>
                    {r.assignedUnits[0] && (
                      <Link href={`/move/${r.assignedUnits[0].assignmentId}`} aria-label="Move room" title="Move room" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <form action={checkOut}>
                      <input type="hidden" name="reservationId" value={r.reservationId} />
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted hover:text-danger-600">
                        <LogOut className="h-3.5 w-3.5" /> Check out
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Departures — due out today (spec §3.1): an explicit list, not just checkout buttons buried in-house. */}
      <Card className="mt-4">
        <CardHeader title="Departures — due out today" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogOut className="h-3.5 w-3.5" />{departures.length}</span>} />
        {departures.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-ink-400">No departures due out today.</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {departures.map((r) => (
              <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink-900">{r.guestName}</span>
                    {r.conflict && <StatusPill tone="danger">Room conflict</StatusPill>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
                    <DoorOpen className="h-3 w-3 text-accent-500" />
                    <AssignedRooms row={r} />
                    <span>· {meta(r)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={`/folio/${r.reservationId}`} aria-label="Folio" title="Folio / bill" className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                    <Receipt className="h-3.5 w-3.5" />
                  </Link>
                  <form action={checkOut}>
                    <input type="hidden" name="reservationId" value={r.reservationId} />
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted hover:text-danger-600">
                      <LogOut className="h-3.5 w-3.5" /> Check out
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Departed today */}
      {departedToday.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Departed today" action={<span className="text-[12px] font-semibold text-ink-400">{departedToday.length}</span>} />
          <ul className="divide-y divide-surface-border">
            {departedToday.map((r) => (
              <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="font-medium text-ink-700">{r.guestName}</span>
                <span className="text-ink-400">{r.roomLabel}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-400">
        Arrivals come from the shared reservation record (RevioCRS / channels). Room-ready reflects the live pool of
        clean/inspected rooms of that type — is housekeeping the blocker? Checking a guest in assigns a physical room and
        marks it occupied; checking out sets the room dirty for housekeeping.
      </p>
    </div>
  );
}
