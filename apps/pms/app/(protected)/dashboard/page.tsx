import Link from "next/link";
import { BedDouble, Wrench, CircleCheck, LogIn, LogOut, Users, ArrowRightLeft, UserPlus, DoorOpen, Receipt, AlertTriangle, Star, Clock, TriangleAlert } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getFrontDeskOverview, type StayRow } from "@/lib/data";
import { checkOut } from "@/lib/actions-frontdesk";
import { HK_LABEL, HK_TONE } from "@/lib/hk-meta";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const READY: Record<"ready" | "partial" | "none", { tone: "success" | "warning" | "danger"; label: string }> = {
  ready: { tone: "success", label: "Room ready" },
  partial: { tone: "warning", label: "Partly ready" },
  none: { tone: "danger", label: "Awaiting housekeeping" },
};

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
function meta(r: StayRow) {
  return `${r.roomLabel} · ${r.nights} night${r.nights === 1 ? "" : "s"}`;
}
/** "past checkout by 2h 10m" / "overstayed 2 nights" — human overdue text. */
function overdueText(r: StayRow): string {
  if (r.overdueState === "overstayed") { const n = Math.round(r.overdueByMinutes / 1440); return `Overstayed ${n} night${n === 1 ? "" : "s"}`; }
  const h = Math.floor(r.overdueByMinutes / 60), m = r.overdueByMinutes % 60;
  return `Past checkout by ${h > 0 ? `${h}h ` : ""}${m}m`;
}

function KpiCard({ icon: Icon, label, value, tint }: { icon: typeof BedDouble; label: string; value: number; tint: string }) {
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <div>
          <div className="tnum text-[22px] font-bold leading-none tracking-tight text-ink-900">{value}</div>
          <div className="mt-1 text-[12px] font-medium text-ink-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const { property, today, totalUnits, arrivals, inHouse, departures, departedToday, conflicts, kpis, exceptions } =
    await getFrontDeskOverview();

  const stayovers = inHouse.filter((s) => !s.dueOutToday && !s.overdueState); // rows shown in the in-house roster
  const overdueCount = exceptions.overstayed.length + exceptions.pastTime.length;

  // Exception strip lines (§1.8a) — built only from items that exist; the strip hides when empty.
  const strip: { key: string; tone: "danger" | "warning" | "info"; icon: typeof AlertTriangle; text: string }[] = [];
  if (exceptions.overstayed.length) strip.push({ key: "overstay", tone: "danger", icon: TriangleAlert, text: `${exceptions.overstayed.length} overstayed — past departure, still in-house (distorts occupancy)` });
  if (exceptions.pastTime.length) strip.push({ key: "pasttime", tone: "warning", icon: Clock, text: `${exceptions.pastTime.length} past checkout time` });
  if (exceptions.blockedArrivals.length) strip.push({ key: "blocked", tone: "warning", icon: AlertTriangle, text: `${exceptions.blockedArrivals.length} arrival${exceptions.blockedArrivals.length === 1 ? "" : "s"} with no ready room` });
  if (exceptions.balanceDueOuts.length) strip.push({ key: "balance", tone: "warning", icon: Receipt, text: `${exceptions.balanceDueOuts.length} due-out${exceptions.balanceDueOuts.length === 1 ? "" : "s"} with a balance` });
  if (exceptions.conflictCount) strip.push({ key: "conflict", tone: "danger", icon: TriangleAlert, text: `${exceptions.conflictCount} room assignment conflict${exceptions.conflictCount === 1 ? "" : "s"}` });
  if (exceptions.returningArrivals.length) strip.push({ key: "vip", tone: "info", icon: Star, text: `${exceptions.returningArrivals.length} returning guest${exceptions.returningArrivals.length === 1 ? "" : "s"} arriving` });

  const STRIP_TONE = {
    danger: "border-danger-500/40 bg-danger-50 text-danger-700",
    warning: "border-warning-500/40 bg-warning-50 text-warning-700",
    info: "border-brand-500/30 bg-brand-50 text-brand-700",
  } as const;

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

      {/* "Needs attention" exception strip (§1.8a) — the headline pattern: exceptions find the receptionist,
          routine stays quiet. Renders only when it has content. */}
      {strip.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {strip.map((s) => (
            <div key={s.key} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[12.5px] font-medium ${STRIP_TONE[s.tone]}`}>
              <s.icon className="h-4 w-4 shrink-0" />
              {s.text}
            </div>
          ))}
        </div>
      )}

      {/* Front-desk KPI row (§1.1) — desk-relevant metrics, not housekeeping counts. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard icon={LogIn} label="Arrivals today" value={kpis.arrivals} tint="bg-brand-50 text-brand-600" />
        <KpiCard icon={LogOut} label="Departures today" value={kpis.departures} tint="bg-warning-50 text-warning-600" />
        <KpiCard icon={Users} label="In-house" value={kpis.inHouse} tint="bg-accent-50 text-accent-600" />
        <KpiCard icon={CircleCheck} label="Rooms ready to assign" value={kpis.roomsReady} tint="bg-success-50 text-success-600" />
        <KpiCard icon={Wrench} label="Out of order" value={kpis.outOfOrder} tint="bg-danger-50 text-danger-600" />
      </div>

      {/* Two co-equal action columns (§1.2): To check in · Due out today. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Arrivals — to check in */}
        <Card>
          <CardHeader
            title="To check in"
            action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogIn className="h-3.5 w-3.5" />{arrivals.length}{exceptions.blockedArrivals.length > 0 && <span className="ml-1 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-600">{exceptions.blockedArrivals.length} blocked</span>}</span>}
          />
          {arrivals.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12px] text-ink-400">No one left to check in today.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {arrivals.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.returning && <span title="Returning guest" className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700"><Star className="h-3 w-3" /> Returning</span>}
                      {r.overdue && <StatusPill tone="danger">Overdue</StatusPill>}
                      {/* Room-ready is decision-relevant on an arrival (§1.5). */}
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

        {/* Departures — due out today (+ overstayed). Check-out lives ONLY here (§1.3). */}
        <Card>
          <CardHeader
            title="Due out today"
            action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogOut className="h-3.5 w-3.5" />{departures.length}{overdueCount > 0 && <span className="ml-1 rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger-600">{overdueCount} overdue</span>}</span>}
          />
          {departures.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12px] text-ink-400">No departures due out today.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {departures.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.overdueState && <StatusPill tone={r.overdueState === "overstayed" ? "danger" : "warning"}>{overdueText(r)}</StatusPill>}
                      {(r.balanceMinor ?? 0) > 0 && <StatusPill tone="warning">Balance {money(r.balanceMinor!, r.currency)}</StatusPill>}
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
      </div>

      {/* Double-assignment detail (§3.1) — kept for the specific room/guest pairs behind the strip count. */}
      {conflicts.length > 0 && (
        <Card className="mt-4 border-danger-500/40 bg-danger-50/60 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
            <div className="text-[13px] text-ink-700">
              <span className="font-semibold text-danger-700">Room assignment conflict.</span> The same physical room holds more than one in-house guest — resolve with a room move:
              <ul className="mt-1.5 space-y-0.5">
                {conflicts.map((c) => (
                  <li key={c.unitLabel} className="text-[12.5px]"><span className="font-semibold text-ink-900">Room {c.unitLabel}</span> — {c.guests.join(" & ")}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* In-house roster (§1.2): a collapsible section beneath the action columns. Auto-open when there's no
          check-in/out work; collapsed otherwise. Rows keep folio · move · open reservation — NOT check out (§1.3). */}
      <details className="group mt-4" open={arrivals.length === 0 && departures.length === 0}>
        <Card>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-surface-muted">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-800"><Users className="h-4 w-4 text-ink-400" /> In-house roster</span>
            <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-400">{inHouse.length} in house<span className="text-ink-300 transition-transform group-open:rotate-90">›</span></span>
          </summary>
          {stayovers.length === 0 ? (
            <div className="border-t border-surface-border px-4 py-4 text-center text-[12px] text-ink-400">
              {inHouse.length === 0 ? "No one in house tonight." : "Everyone in house is due out today — see the column above."}
            </div>
          ) : (
            <ul className="divide-y divide-surface-border border-t border-surface-border">
              {stayovers.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
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
                    <Link href={`/reservation/${r.reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">Open</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </details>

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
        Exceptions surface at the top; routine stays quiet. Arrivals come from the shared reservation record
        (RevioCRS / channels). Rooms-ready reflects the live pool of clean/inspected rooms — is housekeeping the blocker?
        Overdue is measured against the property checkout time ({property.checkOutTime}, set in Configuration).
      </p>
    </div>
  );
}
