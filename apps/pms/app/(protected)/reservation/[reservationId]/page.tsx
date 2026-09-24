import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Receipt, ArrowRightLeft, LogIn, DoorOpen, Building2, Tag, CreditCard,
  ShieldCheck, Utensils, CircleDot, PlusCircle, KeyRound, LogOut, Ban, Sparkles, RotateCcw, Users,
} from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { findReservationElsewhere, getReservationDetail, type TimelineEvent, type StayState } from "@/lib/folio";
import { WrongProperty } from "@/components/reservation/WrongProperty";
import { checkOut, reopenStay, changeStayOccupancy } from "@/lib/actions-frontdesk";
import { todayInTz } from "@/lib/format";
import { HK_TONE } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { common } from "@/lib/i18n/common";
import { stays } from "@/lib/i18n/stays";
import { reservation as reservationDict, type ReservationStrings } from "@/lib/i18n/reservation";
import { GuestRegisterCard } from "@/components/register/GuestRegisterCard";

import { SubmitButton } from "@revio/ui/submit-button";
export const dynamic = "force-dynamic";

const STATE_TONE: Record<StayState, Tone> = {
  booked: "info", assigned: "info", in_house: "success", departed: "neutral", cancelled: "danger",
};

/** The timeline sentence in the reader's language, rebuilt from the kind and the room. */
function eventLabel(e: TimelineEvent, s: ReservationStrings): string {
  const room = e.room ?? "";
  switch (e.kind) {
    case "booking": return s.events.booking;
    case "assigned": return e.room ? s.events.assigned(room) : e.label;
    case "moved": return e.room ? s.events.moved(room) : e.label;
    case "checkin": return e.room ? s.events.checkin(room) : e.label;
    case "checkout": return e.room ? s.events.checkout(room) : e.label;
    case "charge": return s.events.charge;
    case "payment": return s.events.payment;
    case "cancel": return s.events.cancel;
  }
}

const EVENT_ICON: Record<TimelineEvent["kind"], typeof CircleDot> = {
  booking: CircleDot, assigned: KeyRound, moved: ArrowRightLeft, checkin: LogIn,
  checkout: LogOut, charge: PlusCircle, payment: CreditCard, cancel: Ban,
};
const EVENT_TINT: Record<TimelineEvent["kind"], string> = {
  booking: "bg-brand-100 text-brand-700", assigned: "bg-accent-100 text-accent-700",
  moved: "bg-warning-100 text-warning-700", checkin: "bg-success-100 text-success-700",
  checkout: "bg-ink-100 text-ink-600", charge: "bg-brand-50 text-brand-600",
  payment: "bg-success-50 text-success-600", cancel: "bg-danger-100 text-danger-700",
};

function Field({ icon: Icon, label, children }: { icon: typeof Tag; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-semibold text-ink-900">{children}</dd>
    </div>
  );
}

function fmtTime(d: Date, intl: string): string {
  return d.toLocaleString(intl, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function ReservationViewPage({
  params, searchParams,
}: { params: Promise<{ reservationId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { reservationId } = await params;
  const { error } = await searchParams;
  const data = await getReservationDetail(reservationId);
  if (!data) {
    /* ⚠️ Before calling it missing, ask whether it is simply somewhere else. Search reaches every
       property the account holds; this screen is scoped to the active one, so a hit from a sister
       hotel used to land on "We couldn't find that" — the next screen denying what the search had
       just proved exists. */
    const elsewhere = await findReservationElsewhere(reservationId);
    if (elsewhere) {
      return (
        <WrongProperty
          reservationId={reservationId}
          guestName={elsewhere.guestName ?? ""}
          propertyId={elsewhere.propertyId}
          propertyName={elsewhere.propertyName}
        />
      );
    }
    notFound();
  }
  const { guestName, commercial: c, operational: o, events, isManager } = data;
  const { t, money, locale } = await i18n();
  const s = t(reservationDict);
  const cm = t(common);
  const back = t(stays).backToDesk;
  const intl = locale === "bg" ? "bg-BG" : "en-GB";
  const state = { tone: STATE_TONE[o.stayState], label: s.states[o.stayState] };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> {back}
      </Link>
      <PageHeader
        title={guestName}
        subtitle={s.subtitle(c.roomTypes.join(", ") || "—", c.checkIn ?? "?", c.checkOut ?? "?", cm.nights(c.nights))}
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
            {o.dueOut && o.stayState === "in_house" && <StatusPill tone="warning">{s.dueOutToday}</StatusPill>}
          </div>
        }
      />

      <p className="mb-4 text-[11.5px] text-ink-400">
        {s.sharedRecord}
      </p>

      {error === "register_kept" && (
        <div className="mb-4 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
          {s.registerKept}
        </div>
      )}

      {error === "occupancy" && (
        <div className="mb-4 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
          {s.occupancyError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Commercial zone — read-only, from the CRS */}
        <Card>
          <CardHeader title={s.commercial} subtitle={s.commercialSub} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Field icon={Building2} label={s.source}>{c.source}{c.externalId ? ` · #${c.externalId}` : ""}</Field>
            <Field icon={Tag} label={s.ratePlan}>{c.ratePlans.join(", ") || "—"}</Field>
            <Field icon={Utensils} label={s.mealPlan}>{c.mealPlan ?? s.roomOnly}</Field>
            <Field icon={ShieldCheck} label={s.cancellation}>{c.cancellation ?? "—"}</Field>
            <Field icon={CreditCard} label={s.paymentTerms}>{c.paymentGuarantee ? s.payLabels[c.paymentGuarantee] ?? c.paymentGuarantee : "—"}</Field>
            <Field icon={CircleDot} label={s.roomsGuests}>{c.rooms} · {c.guests || "—"}</Field>
            <div className="col-span-2 border-t border-surface-border/60 pt-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{s.total}</dt>
              <dd className="tnum mt-0.5 text-[18px] font-bold text-ink-900">{money(c.totalMinor, c.currency)}</dd>
            </div>
            {c.notes && <div className="col-span-2 text-[12px] text-ink-500">{s.note(c.notes)}</div>}
          </dl>
        </Card>

        {/* Operational zone — PMS-owned */}
        <Card>
          <CardHeader title={s.operational} subtitle={s.operationalSub} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <div className="col-span-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><DoorOpen className="h-3.5 w-3.5" /> {s.assignedRoom}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                {o.assignedUnits.length === 0 ? (
                  <span className="text-[13px] text-ink-400">{s.notAssigned}</span>
                ) : (
                  o.assignedUnits.map((u) => (
                    <span key={u.label} className="inline-flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-accent-600">{u.label}{u.floor ? ` · ${u.floor}` : ""}</span>
                      <StatusPill tone={HK_TONE[u.hkStatus]}>{cm.statuses[u.hkStatus]}</StatusPill>
                    </span>
                  ))
                )}
              </dd>
            </div>
            <Field icon={CircleDot} label={s.stayState}>{state.label}</Field>
            <div className="col-span-2 border-t border-surface-border/60 pt-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <Users className="h-3.5 w-3.5" /> {s.guestsInRoom}
              </dt>
              {/*
                * Editable, and deliberately so: under a per-person rate the party size IS the price,
                * so a party that turns up larger than the booking has to be correctable at the desk.
                * Nights already past are left alone — the change prices forward from today.
                */}
              <dd className="mt-1.5 space-y-1.5">
                {o.stayLines.map((l) => (
                  <form key={l.id} action={changeStayOccupancy} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="reservationId" value={reservationId} />
                    <input type="hidden" name="lineId" value={l.id} />
                    <span className="text-[12.5px] text-ink-600">{l.roomTypeName}</span>
                    <input
                      name="occupancy" type="number" min={1} max={l.maxGuests}
                      defaultValue={l.guestsCount ?? 1}
                      className="tnum w-16 rounded-md border border-surface-border bg-surface px-2 py-1 text-[13px] font-semibold text-ink-900"
                    />
                    <span className="text-[11.5px] text-ink-400">{s.ofMax(l.maxGuests)}</span>
                    <button type="submit" className="rounded-md border border-surface-border px-2.5 py-1 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
                      {s.update}
                    </button>
                  </form>
                ))}
              </dd>
              <p className="mt-1.5 text-[11px] text-ink-400">
                {s.occupancyNote}
              </p>
            </div>
            <Field icon={Receipt} label={s.folioBalance}>
              {o.balance ? <span className={o.balance.balance === 0 ? "text-success-600" : "text-ink-900"}>{money(o.balance.balance, o.currency)}</span> : <span className="text-ink-400">{s.noFolio}</span>}
            </Field>
            <div className="col-span-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Sparkles className="h-3.5 w-3.5" /> {s.deposits}</dt>
              {/* §2.2: real empty state, not dev scaffolding. Deposits shipped in E4 — show what's held. */}
              <dd className="mt-0.5 text-[13px] font-semibold text-ink-900">
                {o.balance && o.balance.depositsHeld > 0
                  ? <span className="text-accent-600">{s.held(money(o.balance.depositsHeld, o.currency))}</span>
                  : <span className="text-ink-400">{s.noDeposit}</span>}
              </dd>
            </div>
          </dl>
          {/* §2.1 — the action hub: every Front Desk action lives here, gated by stay state. */}
          <div className="flex flex-wrap gap-2 border-t border-surface-border/60 p-4">
            <Link href={`/folio/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Receipt className="h-3.5 w-3.5" /> {s.openFolio}
            </Link>
            {o.stayState === "booked" && (
              <Link href={`/checkin/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                <LogIn className="h-3.5 w-3.5" /> {cm.checkIn}
              </Link>
            )}
            {(o.stayState === "assigned" || o.stayState === "in_house") && o.assignedUnits[0] && (
              <Link href={`/move/${o.assignedUnits[0].assignmentId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                <ArrowRightLeft className="h-3.5 w-3.5" /> {cm.moveRoom}
              </Link>
            )}
            {(o.stayState === "in_house" || o.stayState === "assigned") && (
              <Link href={`/minibar/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                <PlusCircle className="h-3.5 w-3.5" /> {s.postCharge}
              </Link>
            )}
            {o.stayState === "in_house" && (
              <form action={checkOut}>
                <input type="hidden" name="reservationId" value={reservationId} />
                <SubmitButton className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted hover:text-danger-600" pendingLabel={cm.checkingOut}>
                  <LogOut className="h-3.5 w-3.5" /> {cm.checkOut}
                </SubmitButton>
              </form>
            )}
            {/* The way back from a mistaken check-out. Check-in refuses a departed stay — which is
                the guard that fixes the state bug — so without this the refusal would just be a
                different dead end. Manager-only, and shown disabled to everyone else so reception
                can see that a route exists and who to ask. */}
            {o.stayState === "departed" && o.departedAt && (
              <form action={reopenStay} className="flex items-center gap-2">
                <input type="hidden" name="reservationId" value={reservationId} />
                <input
                  name="reason"
                  type="text"
                  placeholder={s.reopenPlaceholder}
                  disabled={!isManager}
                  className="h-9 w-52 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600 disabled:cursor-not-allowed disabled:bg-surface-muted"
                />
                <SubmitButton
                  disabled={!isManager}
                  title={isManager ? s.reopenTitle : s.managerOnly}
                  className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {s.reopen}
                </SubmitButton>
              </form>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline — the history of the stay (spec §3.2), the thing almost no PMS does well. */}
      <GuestRegisterCard reservationId={reservationId} rows={o.register} today={todayInTz(data.property.timezone)} />

      <Card className="mt-4">
        <CardHeader title={s.timeline} subtitle={s.timelineSub} />
        <ol className="p-4">
          {events.map((e, i) => {
            const Icon = EVENT_ICON[e.kind];
            return (
              <li key={i} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${EVENT_TINT[e.kind]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-surface-border" />}
                </div>
                <div className="pt-0.5">
                  <div className="text-[13px] font-semibold text-ink-900">{eventLabel(e, s)}</div>
                  {e.detail && <div className="text-[12px] text-ink-500">{e.detail}</div>}
                  <div className="tnum text-[11px] text-ink-400">{fmtTime(e.at, intl)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
