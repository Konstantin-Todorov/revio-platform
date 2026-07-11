import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Receipt, ArrowRightLeft, LogIn, DoorOpen, Building2, Tag, CreditCard,
  ShieldCheck, Utensils, CircleDot, PlusCircle, KeyRound, LogOut, Ban, Sparkles,
} from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getReservationDetail, type TimelineEvent, type StayState } from "@/lib/folio";
import { money } from "@/lib/format";
import { HK_LABEL, HK_TONE } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

const STATE_META: Record<StayState, { tone: Tone; label: string }> = {
  booked: { tone: "info", label: "Booked — not arrived" },
  assigned: { tone: "info", label: "Room assigned" },
  in_house: { tone: "success", label: "In house" },
  departed: { tone: "neutral", label: "Departed" },
  cancelled: { tone: "danger", label: "Cancelled" },
};

const PAY_LABEL: Record<string, string> = {
  card_on_file: "Card on file", company_account: "Company account", prepaid_ota: "Prepaid (OTA)", none: "None",
};

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

function fmtTime(d: Date): string {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function ReservationViewPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const data = await getReservationDetail(reservationId);
  if (!data) notFound();
  const { guestName, commercial: c, operational: o, events } = data;
  const state = STATE_META[o.stayState];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader
        title={guestName}
        subtitle={`${c.roomTypes.join(", ") || "—"} · ${c.checkIn ?? "?"} → ${c.checkOut ?? "?"} · ${c.nights} night${c.nights === 1 ? "" : "s"}`}
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
            {o.dueOut && o.stayState === "in_house" && <StatusPill tone="warning">Due out today</StatusPill>}
          </div>
        }
      />

      <p className="mb-4 text-[11.5px] text-ink-400">
        One shared record, two phases — the commercial fields below were written by RevioCRS / the channel at
        booking; the PMS extends the same record operationally. It is never a synced copy.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Commercial zone — read-only, from the CRS */}
        <Card>
          <CardHeader title="Commercial" subtitle="From RevioCRS / channel · read-only" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <Field icon={Building2} label="Source">{c.source}{c.externalId ? ` · #${c.externalId}` : ""}</Field>
            <Field icon={Tag} label="Rate plan">{c.ratePlans.join(", ") || "—"}</Field>
            <Field icon={Utensils} label="Meal plan">{c.mealPlan ?? "Room only"}</Field>
            <Field icon={ShieldCheck} label="Cancellation">{c.cancellation ?? "—"}</Field>
            <Field icon={CreditCard} label="Payment terms">{c.paymentGuarantee ? PAY_LABEL[c.paymentGuarantee] ?? c.paymentGuarantee : "—"}</Field>
            <Field icon={CircleDot} label="Rooms · guests">{c.rooms} · {c.guests || "—"}</Field>
            <div className="col-span-2 border-t border-surface-border/60 pt-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Reservation total</dt>
              <dd className="tnum mt-0.5 text-[18px] font-bold text-ink-900">{money(c.totalMinor, c.currency)}</dd>
            </div>
            {c.notes && <div className="col-span-2 text-[12px] text-ink-500">Note: {c.notes}</div>}
          </dl>
        </Card>

        {/* Operational zone — PMS-owned */}
        <Card>
          <CardHeader title="Operational" subtitle="PMS-owned · this property today" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <div className="col-span-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><DoorOpen className="h-3.5 w-3.5" /> Assigned room</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                {o.assignedUnits.length === 0 ? (
                  <span className="text-[13px] text-ink-400">Not assigned yet — assigned at check-in</span>
                ) : (
                  o.assignedUnits.map((u) => (
                    <span key={u.label} className="inline-flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-accent-600">{u.label}{u.floor ? ` · ${u.floor}` : ""}</span>
                      <StatusPill tone={HK_TONE[u.hkStatus]}>{HK_LABEL[u.hkStatus]}</StatusPill>
                    </span>
                  ))
                )}
              </dd>
            </div>
            <Field icon={CircleDot} label="Stay state">{state.label}</Field>
            <Field icon={Receipt} label="Folio balance">
              {o.balance ? <span className={o.balance.balance === 0 ? "text-success-600" : "text-ink-900"}>{money(o.balance.balance, o.currency)}</span> : <span className="text-ink-400">No folio yet</span>}
            </Field>
            <div className="col-span-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Sparkles className="h-3.5 w-3.5" /> Deposits</dt>
              <dd className="mt-0.5 text-[12.5px] text-ink-400">Deposit handling arrives in phase E4.</dd>
            </div>
          </dl>
          {/* Quick actions — the folio and move stay one click away (spec §3.1). */}
          <div className="flex flex-wrap gap-2 border-t border-surface-border/60 p-4">
            <Link href={`/folio/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <Receipt className="h-3.5 w-3.5" /> Open folio
            </Link>
            {o.stayState === "booked" && (
              <Link href={`/checkin/${reservationId}`} className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted">
                <LogIn className="h-3.5 w-3.5" /> Check in
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline — the history of the stay (spec §3.2), the thing almost no PMS does well. */}
      <Card className="mt-4">
        <CardHeader title="Timeline" subtitle="Booking received → assigned → checked in → moved → charges → checked out" />
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
                  <div className="text-[13px] font-semibold text-ink-900">{e.label}</div>
                  {e.detail && <div className="text-[12px] text-ink-500">{e.detail}</div>}
                  <div className="tnum text-[11px] text-ink-400">{fmtTime(e.at)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
