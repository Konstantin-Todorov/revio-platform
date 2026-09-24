import Link from "next/link";
import { BedDouble, Wrench, CircleCheck, LogIn, LogOut, Users, ArrowRightLeft, UserPlus, DoorOpen, Receipt, AlertTriangle, Star, Clock, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { hasFinishedSetup } from "@revio/core";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { SetupChecklist } from "@revio/ui/setup-checklist";
import { StatCard, type StatTone } from "@revio/ui/stat-card";
import { prisma } from "@/lib/db";
import { activeProperty, getFrontDeskOverview, type StayRow } from "@/lib/data";
import { getSetup } from "@/lib/setup";
import { checkOut } from "@/lib/actions-frontdesk";
import { HK_TONE } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { common, type CommonStrings } from "@/lib/i18n/common";
import { frontdesk, type FrontDeskStrings } from "@/lib/i18n/frontdesk";

import { SubmitButton } from "@revio/ui/submit-button";
export const dynamic = "force-dynamic";

const READY_TONE: Record<"ready" | "partial" | "none", "success" | "warning" | "danger"> = {
  ready: "success", partial: "warning", none: "danger",
};

function AssignedRooms({ row, c }: { row: StayRow; c: CommonStrings }) {
  if (row.assignedUnits.length === 0) return <span className="text-ink-400">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.assignedUnits.map((u) => (
        <span key={u.unitId} className="inline-flex items-center gap-1">
          <span className="font-semibold text-accent-600">{u.unitLabel}</span>
          <StatusPill tone={HK_TONE[u.hkStatus]}>{c.statuses[u.hkStatus]}</StatusPill>
        </span>
      ))}
    </span>
  );
}

function meta(r: StayRow, c: CommonStrings) {
  return `${r.roomLabel} · ${c.nights(r.nights)}`;
}
/** "past checkout by 2h 10m" / "overstayed 2 nights" — human overdue text. */
function overdueText(r: StayRow, s: FrontDeskStrings): string {
  if (r.overdueState === "overstayed") return s.overstayed(Math.round(r.overdueByMinutes / 1440));
  return s.pastCheckout(Math.floor(r.overdueByMinutes / 60), r.overdueByMinutes % 60);
}

/**
 * The front-desk KPI row, on the shared `StatCard`.
 *
 * It was a third hand-rolled copy of the same object — the CRS dashboard and CRS Analytics had the
 * other two, differing from each other by a font size and two pixels of padding. `StatCard` already
 * takes an icon and a tone, so this is a mapping rather than a rewrite.
 *
 * The tone says what the metric IS, never whether today's number is good: "Out of order" is danger
 * because rooms out of order are a fault condition, not because five is worse than three. A card
 * that changed colour with its own value would make the row unlearnable.
 *
 * `animate-rise` moves to a wrapper rather than becoming a `StatCard` prop — the stagger is this
 * screen's entrance, not something every stat card in the platform should inherit.
 */
function KpiCard({ icon: Icon, label, value, tone }: { icon: typeof BedDouble; label: string; value: number; tone: StatTone }) {
  return (
    <div className="animate-rise">
      <StatCard label={label} value={String(value)} tone={tone} icon={<Icon className="h-4 w-4" strokeWidth={2.1} />} />
    </div>
  );
}

export default async function DashboardPage() {
  /**
   * A hotel that has never configured anything goes into the guided flow instead of a front desk of
   * zeros. The honest test for "has not started" is having no physical rooms: without units nothing
   * on this screen can do anything, and an established hotel that simply never clicked the last
   * setup screen is not dragged back through it.
   */
  const { property: activeProp } = await activeProperty();
  if (!hasFinishedSetup(activeProp.setupCompleted, "RevioPMS")) {
    const unitCount = await prisma.unit.count({ where: { propertyId: activeProp.id } });
    if (unitCount === 0) redirect("/welcome/property");
  }

  const [{ property, today, arrivals, inHouse, departures, departedToday, conflicts, kpis, exceptions }, setup, { t, money, day }] =
    await Promise.all([getFrontDeskOverview(), getSetup(), i18n()]);
  const s = t(frontdesk);
  const c = t(common);

  const stayovers = inHouse.filter((s) => !s.dueOutToday && !s.overdueState); // rows shown in the in-house roster
  const overdueCount = exceptions.overstayed.length + exceptions.pastTime.length;

  // Exception strip lines (§1.8a) — built only from items that exist; the strip hides when empty.
  const strip: { key: string; tone: "danger" | "warning" | "info"; icon: typeof AlertTriangle; text: string }[] = [];
  if (exceptions.overstayed.length) strip.push({ key: "overstay", tone: "danger", icon: TriangleAlert, text: s.strip.overstayed(exceptions.overstayed.length) });
  if (exceptions.pastTime.length) strip.push({ key: "pasttime", tone: "warning", icon: Clock, text: s.strip.pastTime(exceptions.pastTime.length) });
  if (exceptions.blockedArrivals.length) strip.push({ key: "blocked", tone: "warning", icon: AlertTriangle, text: s.strip.blocked(exceptions.blockedArrivals.length) });
  if (exceptions.balanceDueOuts.length) strip.push({ key: "balance", tone: "warning", icon: Receipt, text: s.strip.balance(exceptions.balanceDueOuts.length) });
  if (exceptions.conflictCount) strip.push({ key: "conflict", tone: "danger", icon: TriangleAlert, text: s.strip.conflict(exceptions.conflictCount) });
  if (exceptions.returningArrivals.length) strip.push({ key: "vip", tone: "info", icon: Star, text: s.strip.returning(exceptions.returningArrivals.length) });

  const STRIP_TONE = {
    danger: "border-danger-500/40 bg-danger-50 text-danger-700",
    warning: "border-warning-500/40 bg-warning-50 text-warning-700",
    info: "border-brand-500/30 bg-brand-50 text-brand-700",
  } as const;

  return (
    <div>
      <PageHeader
        title={s.title}
        subtitle={s.subtitle(property.name, day(today))}
        action={
          <Link href="/walkin" className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-500">
            <UserPlus className="h-4 w-4" /> {s.walkIn}
          </Link>
        }
      />

      {/* First run: the shortest honest path to checking a guest in. Gone for good once complete. */}
      {setup.show && (
        <SetupChecklist
          productName="RevioPMS"
          promise={s.setupPromise}
          steps={setup.steps}
          done={setup.done}
          total={setup.total}
        />
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
        <KpiCard icon={LogIn} label={s.kpi.arrivals} value={kpis.arrivals} tone="brand" />
        <KpiCard icon={LogOut} label={s.kpi.departures} value={kpis.departures} tone="warning" />
        <KpiCard icon={Users} label={s.kpi.inHouse} value={kpis.inHouse} tone="accent" />
        <KpiCard icon={CircleCheck} label={s.kpi.roomsReady} value={kpis.roomsReady} tone="success" />
        <KpiCard icon={Wrench} label={s.kpi.outOfOrder} value={kpis.outOfOrder} tone="danger" />
      </div>

      {/* Two co-equal action columns (§1.2): To check in · Due out today. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Arrivals — to check in */}
        <Card>
          <CardHeader
            title={s.toCheckIn}
            action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogIn className="h-3.5 w-3.5" />{arrivals.length}{exceptions.blockedArrivals.length > 0 && <span className="ml-1 rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-600">{s.blocked(exceptions.blockedArrivals.length)}</span>}</span>}
          />
          {arrivals.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12px] text-ink-400">{s.noArrivals}</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {arrivals.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.returning && <span title={c.returningGuest} className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700"><Star className="h-3 w-3" /> {c.returning}</span>}
                      {r.overdue && <StatusPill tone="danger">{c.overdue}</StatusPill>}
                      {/* Room-ready is decision-relevant on an arrival (§1.5). */}
                      {r.roomReady && <StatusPill tone={READY_TONE[r.roomReady]}>{c.ready[r.roomReady]}</StatusPill>}
                    </div>
                    <div className="text-[11.5px] text-ink-500">{meta(r, c)}</div>
                  </div>
                  <Link href={`/checkin/${r.reservationId}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-800 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700">
                    <LogIn className="h-3.5 w-3.5" /> {c.checkIn}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Departures — due out today (+ overstayed). Check-out lives ONLY here (§1.3). */}
        <Card>
          <CardHeader
            title={s.dueOutToday}
            action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogOut className="h-3.5 w-3.5" />{departures.length}{overdueCount > 0 && <span className="ml-1 rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold text-danger-600">{s.overdueCount(overdueCount)}</span>}</span>}
          />
          {departures.length === 0 ? (
            <div className="px-4 py-4 text-center text-[12px] text-ink-400">{s.noDepartures}</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {departures.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.overdueState && <StatusPill tone={r.overdueState === "overstayed" ? "danger" : "warning"}>{overdueText(r, s)}</StatusPill>}
                      {(r.balanceMinor ?? 0) > 0 && <StatusPill tone="warning">{c.balance(money(r.balanceMinor!, r.currency))}</StatusPill>}
                      {r.conflict && <StatusPill tone="danger">{c.roomConflict}</StatusPill>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
                      <DoorOpen className="h-3 w-3 text-accent-500" />
                      <AssignedRooms row={r} c={c} />
                      <span>· {meta(r, c)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={`/folio/${r.reservationId}`} aria-label={c.folio} title={c.folioTitle} className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                      <Receipt className="h-3.5 w-3.5" />
                    </Link>
                    <form action={checkOut}>
                      <input type="hidden" name="reservationId" value={r.reservationId} />
                      <SubmitButton className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted hover:text-danger-600" pendingLabel={c.checkingOut}>
                        <LogOut className="h-3.5 w-3.5" /> {c.checkOut}
                      </SubmitButton>
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
              <span className="font-semibold text-danger-700">{s.conflictLead}</span> {s.conflictBody}
              <ul className="mt-1.5 space-y-0.5">
                {conflicts.map((cf) => (
                  <li key={cf.unitLabel} className="text-[12.5px]"><span className="font-semibold text-ink-900">{c.room(cf.unitLabel)}</span> — {cf.guests.join(" & ")}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* In-house roster (§1.2): a collapsible section beneath the action columns. Auto-open when there's no
          check-in/out work; collapsed otherwise. Rows keep folio · move · open reservation — NOT check out (§1.3). */}
      {/*
        The <summary> must be the FIRST CHILD of <details>, and it was nested inside the <Card>.
        With a <section> between them the browser treats the <details> as having no summary at all:
        the whole <details> becomes the focus target, no focus ring can land on the row a user is
        actually looking at, and the disclosure only toggles because Chrome is lenient about it.
        Found by tabbing this page — focus reached "In-house roster" and drew nothing.
        The Card now wraps the details instead, which keeps the surface identical.
      */}
      <Card surface="flat" className="mt-4 overflow-hidden">
        <details className="group" open={arrivals.length === 0 && departures.length === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors duration-fast ease-standard hover:bg-surface-muted">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-800"><Users className="h-4 w-4 text-ink-400" /> {s.roster}</span>
            <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-400">{s.inHouseCount(inHouse.length)}<span className="text-ink-300 transition-transform group-open:rotate-90">›</span></span>
          </summary>
          {stayovers.length === 0 ? (
            <div className="border-t border-surface-border px-4 py-4 text-center text-[12px] text-ink-400">
              {inHouse.length === 0 ? s.nobodyInHouse : s.allDueOut}
            </div>
          ) : (
            <ul className="divide-y divide-surface-border border-t border-surface-border">
              {stayovers.map((r) => (
                <li key={r.reservationId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/reservation/${r.reservationId}`} className="truncate text-[13px] font-semibold text-ink-900 hover:text-accent-600 hover:underline">{r.guestName}</Link>
                      {r.conflict && <StatusPill tone="danger">{c.roomConflict}</StatusPill>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-500">
                      <DoorOpen className="h-3 w-3 text-accent-500" />
                      <AssignedRooms row={r} c={c} />
                      <span>· {meta(r, c)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link href={`/folio/${r.reservationId}`} aria-label={c.folio} title={c.folioTitle} className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                      <Receipt className="h-3.5 w-3.5" />
                    </Link>
                    {r.assignedUnits[0] && (
                      <Link href={`/move/${r.assignedUnits[0].assignmentId}`} aria-label={c.moveRoom} title={c.moveRoom} className="flex h-8 w-8 items-center justify-center rounded-md border border-surface-border text-ink-500 transition-colors hover:bg-surface-muted">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    <Link href={`/reservation/${r.reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">{c.open}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </details>
      </Card>

      {/* Departed today */}
      {departedToday.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={s.departedToday} action={<span className="text-[12px] font-semibold text-ink-400">{departedToday.length}</span>} />
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
        {s.footnote(property.checkOutTime)}
      </p>
    </div>
  );
}
