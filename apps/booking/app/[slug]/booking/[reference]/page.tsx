import { extrasTotalMinor, type StayTerms } from "@revio/core";
import { termsWords } from "@/lib/i18n/kit";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarPlus, Check, Clock, MapPin, Navigation, Phone, X } from "lucide-react";
import { forTenant } from "@revio/db";
import { computeStayCharges, recogniseGuest, SOLD_STATUSES } from "@revio/core";
import { getPublicProperty, type PublicProperty } from "@/lib/property";
import { nightsBetween } from "@/lib/dates";
import { serverKit } from "@/lib/i18n/server";
import type { GuestKit } from "@/lib/i18n/kit";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { StepBar } from "@/components/StepBar";
import { AskManageLink, ManagePanel } from "@/components/ManageBooking";
import { bookingReference, manageAbility, previewSettlement } from "@revio/booking";
import { directionsUrl, stayGoogleCalendarUrl, todayInTimeZone } from "@revio/core";
import { mayManage } from "@/lib/manage";

export const dynamic = "force-dynamic";

/**
 * Step 4 — it's booked.
 *
 * Reachable by reference alone, with no session, because that is how a guest actually returns to it:
 * from the link in their confirmation email, days later, on a different device. The reference is
 * derived from the reservation id, so it is unguessable in practice, and the page shows only what
 * the guest already knows — their own booking. No card details, no internal ids, no other guest.
 */
export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; reference: string }>;
  searchParams: Promise<{ k?: string; error?: string; changed?: string }>;
}) {
  const { slug, reference } = await params;
  const sp = await searchParams;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const suffix = reference.replace(/^RV-/i, "").toLowerCase();
  // Cheap sanity check before touching the database — the reference is a fixed shape.
  if (!/^[a-z0-9]{6}$/.test(suffix)) notFound();

  const db = forTenant(property.tenantId);
  const reservation = await db.reservation.findFirst({
    where: { propertyId: property.id, id: { endsWith: suffix } },
    include: {
      lines: { include: { roomType: true, ratePlan: { include: { cancellationPolicy: true } } } },
      guest: true,
    },
  });
  if (!reservation) notFound();

  const line = reservation.lines[0];
  if (!line) notFound();

  // Returning-guest recognition (K6). Counted excluding THIS reservation, and silent when the guest
  // has opted out. Sold statuses only — a past cancellation is not a stay, and greeting someone as a
  // regular because they once cancelled is the kind of small wrongness that discredits the feature.
  const priorStays = reservation.guest
    ? await db.reservation.findMany({
        where: {
          propertyId: property.id,
          guestId: reservation.guest.id,
          id: { not: reservation.id },
          status: { in: [...SOLD_STATUSES] },
          // Rooms booked together with this one are not earlier stays.
          ...(reservation.bookingGroupId ? { NOT: { bookingGroupId: reservation.bookingGroupId } } : {}),
        },
        select: { lines: { select: { checkIn: true }, orderBy: { checkIn: "desc" }, take: 1 } },
      })
    : [];
  const lastPrior = priorStays
    .map((r) => r.lines[0]?.checkIn)
    .filter((d): d is Date => d != null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const recognition = recogniseGuest({
    priorStayCount: priorStays.length,
    lastStayDate: lastPrior ? lastPrior.toISOString().slice(0, 10) : null,
    optedOut: reservation.guest?.recognitionOptOut ?? false,
  });

  const checkIn = line.checkIn.toISOString().slice(0, 10);
  const checkOut = line.checkOut.toISOString().slice(0, 10);
  const nights = nightsBetween(checkIn, checkOut);

  /**
   * The all-in total, rebuilt with the same core function the quote and the folio use.
   *
   * The reservation stores accommodation only (room revenue is what ADR and RevPAR are built on), so
   * showing the guest their real total means recomputing the fees — from one implementation, which
   * is exactly why they cannot disagree.
   */
  const [fees, defaults] = await Promise.all([
    db.taxFee.findMany({ where: { propertyId: property.id, active: true } }),
    db.propertyDefaults.findFirst({ where: { propertyId: property.id } }),
  ]);
  // The extras they chose are part of what they owe — the same all-in number the booking step and
  // the email stated. Leaving them out made this page show a smaller total than the one agreed.
  const extras = await db.stayExtra.findMany({
    where: { reservationId: reservation.id, active: true },
    select: { name: true, priceMinor: true, basis: true },
    orderBy: { createdAt: "asc" },
  });
  const extraBasis = (b: string) => (b === "per_stay" ? "per_stay" : "per_night") as "per_stay" | "per_night";
  const charged = computeStayCharges({
    stay: { accommodationMinor: line.priceMinor ?? 0, nights, rooms: 1, guests: line.guestsCount ?? 2 },
    fees: fees as never,
    cityTaxIncluded: defaults?.cityTaxMode === "included",
    extrasMinor: extrasTotalMinor(extras.map((e) => ({ priceMinor: e.priceMinor, basis: extraBasis(e.basis) })), nights),
  });

  // The terms as agreed at booking, and what was taken — frozen facts, never today's policy.
  const agreedTerms = (reservation.stayTerms ?? null) as StayTerms | null;
  const paidMinor = reservation.onlinePaidMinor ?? 0;
  const atHotelMinor = agreedTerms
    ? agreedTerms.atHotelMinor
    : Math.max(0, charged.totalMinor - paidMinor - (reservation.balanceChargeMinor ?? 0));

  const kit = await serverKit(property);
  const { s: t, fmtDay, money } = kit;
  const s = t.done;
  const cancelled = reservation.status === "cancelled";
  // The hotel has not accepted this yet — it happens when they have not finished connecting Stripe,
  // so no card guarantee could be taken and an instant confirmation would be a promise nobody made.
  const requested = reservation.status === "requested";

  /*
   * Managing it. The reference only SHOWS a booking; the key from the email link is what lets this
   * visitor change it. Without the key, the page offers to email that link — never the buttons.
   */
  const today = todayInTimeZone(property.timezone);
  const canManage = await mayManage(reservation, sp.k);
  const calEvent = {
    uid: `${reference.toUpperCase()}@reviosoft.app`, title: property.name, checkIn, checkOut,
    checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, timezone: property.timezone,
    location: property.address, description: `${reference.toUpperCase()} · ${line.roomType?.name ?? ""}`,
  };
  // Rooms booked together: the others in the group, each its own reservation and reference.
  const siblings = reservation.bookingGroupId
    ? await db.reservation.findMany({
        where: { propertyId: property.id, bookingGroupId: reservation.bookingGroupId, id: { not: reservation.id } },
        select: { id: true, status: true, lines: { select: { roomType: { select: { name: true } }, guestsCount: true, childrenCount: true, infantsCount: true }, take: 1 } },
        orderBy: { importedAt: "asc" },
      })
    : [];
  const ability = manageAbility({ ...reservation, checkIn, today });
  const m = t.manage;
  const settlement = previewSettlement(reservation, "cancel", today);
  const cancelWords = !settlement
    ? m.noTerms
    : settlement.feeMinor === 0
      ? settlement.refundMinor > 0 ? m.freeRefund(money(settlement.refundMinor, reservation.currency)) : m.free
      : [
          m.fee(money(settlement.feeMinor, reservation.currency)),
          settlement.refundMinor > 0 ? m.refundPart(money(settlement.refundMinor, reservation.currency)) : null,
          settlement.chargeMinor > 0 ? m.chargePart(money(settlement.chargeMinor, reservation.currency)) : null,
        ].filter(Boolean).join(" ");
  const changeBlockText =
    ability.changeBlock === "paid_online" ? m.blockedPaid(property.phone)
    : ability.changeBlock === "not_confirmed" && requested ? m.blockedRequested
    : null;
  const errorText = sp.error === "in_house" ? m.inHouse : sp.error ? m.notAllowed : null;

  return (
    <>
      <PropertyHeader property={property} />

      <main className="mx-auto w-full max-w-[52rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar current="Confirm" s={t.steps} />

        <div className="mt-8 text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={
              cancelled
                ? { backgroundColor: "hsl(var(--caution) / 0.12)", color: "hsl(var(--caution))" }
                : { backgroundColor: "hsl(var(--positive) / 0.12)", color: "hsl(var(--positive))" }
            }
          >
            {cancelled ? <X size={26} strokeWidth={2.6} aria-hidden /> : <Check size={26} strokeWidth={2.6} aria-hidden />}
          </span>
          {/*
            Three outcomes, three headlines. A request-to-book is NOT a confirmation and must never
            be dressed as one — the hotel has not accepted it yet, and a guest who reads "You're
            booked" and turns up to nothing has been lied to by a UI copy decision.
          */}
          <h1 className="display mt-5 text-[2rem] sm:text-[2.6rem]">
            {cancelled ? s.cancelledTitle : requested ? s.requestTitle : s.bookedTitle}
          </h1>
          <p className="mt-3 text-[15px]" style={{ color: "hsl(var(--ink-soft))" }}>
            {cancelled ? (
              <>{s.cancelledBody}</>
            ) : requested ? (
              <>
                {s.requestLead(property.name)}{" "}
                <strong style={{ color: "hsl(var(--ink))" }}>{reservation.guest?.email}</strong>{s.requestTail}
              </>
            ) : (
              <>
                {s.bookedBody}{" "}
                <strong style={{ color: "hsl(var(--ink))" }}>{reservation.guest?.email}</strong>.
              </>
            )}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold"
             style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}>
            {s.reference(reference.toUpperCase())}
          </p>

          {sp.changed && !cancelled && (
            <p className="mx-auto mt-4 max-w-md rounded-lg px-4 py-2.5 text-[13.5px] font-semibold" role="status"
               style={{ backgroundColor: "hsl(var(--positive) / 0.1)", color: "hsl(var(--positive))" }}>
              {m.changedNotice}
            </p>
          )}
          {errorText && (
            <p className="mx-auto mt-4 max-w-md rounded-lg px-4 py-2.5 text-[13.5px] font-semibold" role="alert"
               style={{ backgroundColor: "hsl(var(--caution) / 0.1)", color: "hsl(var(--caution))" }}>
              {errorText}
            </p>
          )}
          {/* What the cancellation did with their money — from what actually moved, not the terms. */}
          {cancelled && (reservation.refundedOnlineMinor ?? 0) > 0 && (
            <p className="mt-3 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {m.cancelledRefund(money(reservation.refundedOnlineMinor!, reservation.currency))}
            </p>
          )}
          {cancelled && (reservation.feeChargedMinor ?? 0) > 0 && (
            <p className="mt-2 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {m.cancelledFee(money(reservation.feeChargedMinor!, reservation.currency))}
            </p>
          )}

          {/* K6. Computed server-side from the shared guest record, never passed in a query param a
              stranger could fake — this page is reachable by reference alone, so anything shown here
              has to be true for everyone who can reach it, not just for whoever just booked.
              It says the guest is known; it does not repeat anything about their past stays. */}
          {recognition.isReturning && (
            <p className="mt-3 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {s.welcomeBack(recognition.priorStayCount + 1)}
            </p>
          )}
        </div>

        <section className="card-raised mt-8 overflow-hidden">
          <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "hsl(var(--line))" }}>
            <h2 className="display text-[1.2rem]">{line.roomType?.name}</h2>
            <p className="mt-1 text-[13px]" style={{ color: "hsl(var(--ink-soft))" }}>
              {line.ratePlan?.name}
              {line.ratePlan?.cancellationPolicy?.name ? ` · ${line.ratePlan.cancellationPolicy.name}` : ""}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-px sm:grid-cols-3" style={{ backgroundColor: "hsl(var(--line))" }}>
            <Cell icon={<CalendarCheck size={15} aria-hidden />} term={s.checkIn}
                  value={fmtDay(checkIn)} sub={s.from(property.checkInTime)} />
            <Cell icon={<CalendarCheck size={15} aria-hidden />} term={s.checkOut}
                  value={fmtDay(checkOut)} sub={s.by(property.checkOutTime)} />
            <Cell icon={<Clock size={15} aria-hidden />} term={s.length}
                  value={t.count.nights(nights)}
                  sub={t.bar.party(line.guestsCount ?? 2, line.childrenCount + line.infantsCount)} />
          </dl>

          <div className="px-5 py-4 sm:px-6">
            <dl className="space-y-1.5 text-[13px]">
              <Row label={t.room.roomsFor(nights)}
                   value={money(charged.accommodationMinor, reservation.currency)} />
              {extras.map((e) => (
                <Row key={e.name} label={e.name}
                     value={money(extrasTotalMinor([{ priceMinor: e.priceMinor, basis: extraBasis(e.basis) }], nights), reservation.currency)} />
              ))}
              {charged.lines.map((l) => (
                <Row key={l.name} label={l.name} value={money(l.amountMinor, reservation.currency)} />
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t pt-3" style={{ borderColor: "hsl(var(--line))" }}>
              <span className="text-[13.5px] font-semibold">{cancelled ? s.cancelledTotal : paidMinor > 0 ? s.total : s.totalAtHotel}</span>
              <span className={`price ${cancelled ? "text-[1.1rem] line-through" : "text-[1.5rem]"}`}
                    style={cancelled ? { color: "hsl(var(--ink-faint))" } : undefined}>
                {money(charged.totalMinor, reservation.currency)}
              </span>
            </div>
            {/* What was taken, what will be, and what is left for the hotel — from what was
                actually recorded at booking, never recomputed from today's policy. */}
            {!cancelled && paidMinor > 0 && (
              <dl className="mt-2 space-y-1 text-[13px]">
                <Row label={s.paidOnline(reservation.guaranteeLast4 ?? "")} value={money(paidMinor, reservation.currency)} />
                {reservation.balanceChargeMinor && reservation.balanceChargeOn ? (
                  <Row label={s.chargedOn(fmtDay(reservation.balanceChargeOn.toISOString().slice(0, 10)))}
                       value={money(reservation.balanceChargeMinor, reservation.currency)} />
                ) : null}
                {atHotelMinor > 0 && <Row label={s.atHotel} value={money(atHotelMinor, reservation.currency)} />}
              </dl>
            )}
            {!cancelled && paidMinor === 0 && (
              <p className="mt-2 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                {reservation.guaranteeLast4 ? s.guaranteeOnly(reservation.guaranteeLast4) : s.nothingCharged}
              </p>
            )}
            {!cancelled && agreedTerms && (
              <div className="mt-4 border-t pt-3 text-[12.5px]" style={{ borderColor: "hsl(var(--line))", color: "hsl(var(--ink-soft))" }}>
                <p className="font-semibold" style={{ color: "hsl(var(--ink))" }}>{kit.s.book.terms}</p>
                <ul className="mt-1 space-y-0.5">
                  {termsWords(kit, agreedTerms, reservation.currency).details.slice(1).map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* What a guest does next with a booking: put it in the calendar, find the way there. */}
        {!cancelled && !requested && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={stayGoogleCalendarUrl(calEvent)}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-outline min-h-[40px] px-4 text-[13.5px]"
            >
              <CalendarPlus size={15} aria-hidden /> {s.addGoogle}
            </a>
            <a href={`/${property.slug}/booking/${reference.toUpperCase()}/calendar`} className="btn btn-outline min-h-[40px] px-4 text-[13.5px]">
              <CalendarPlus size={15} aria-hidden /> {s.addIcs}
            </a>
            {property.address && (
              <a href={directionsUrl(property.name, property.address)} target="_blank" rel="noopener noreferrer" className="btn btn-outline min-h-[40px] px-4 text-[13.5px]">
                <Navigation size={15} aria-hidden /> {s.directions}
              </a>
            )}
          </div>
        )}

        {siblings.length > 0 && (
          <section className="card mt-5 p-5">
            <h2 className="eyebrow">{t.group.othersTitle}</h2>
            <ul className="mt-2 space-y-1.5 text-[13.5px]">
              {siblings.map((sib) => {
                const l = sib.lines[0];
                const ref = bookingReference(sib.id);
                return (
                  <li key={sib.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <a href={`/${property.slug}/booking/${ref}${sp.k ? `?k=${encodeURIComponent(sp.k)}` : ""}`} className="link-quiet font-semibold">
                      {l?.roomType.name ?? ref} · {ref}
                    </a>
                    <span style={{ color: "hsl(var(--ink-soft))" }}>
                      {sib.status === "cancelled" ? t.group.cancelled : t.bar.party(l?.guestsCount ?? 2, (l?.childrenCount ?? 0) + (l?.infantsCount ?? 0))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!cancelled && (ability.canCancel || ability.canChange) && (
          canManage ? (
            <ManagePanel
              slug={property.slug}
              reference={reference.toUpperCase()}
              manageKey={sp.k!}
              canChange={ability.canChange}
              changeBlockText={changeBlockText}
              canCancel={ability.canCancel}
              cancelWords={cancelWords}
            />
          ) : (
            <AskManageLink slug={property.slug} reference={reference.toUpperCase()} />
          )
        )}

        {!cancelled && <WhatNext property={property} requested={requested} paid={paidMinor > 0} managed={canManage && (ability.canCancel || ability.canChange)} kit={kit} />}
      </main>

      <PropertyFooter property={property} />
    </>
  );
}

/** The questions a guest actually has once the booking is done — or once they have asked for it. */
function WhatNext({ property, requested, paid, managed, kit }: { property: PublicProperty; requested: boolean; paid: boolean; managed: boolean; kit: GuestKit }) {
  const s = kit.s.done;
  const phone = property.phone ? <> {s.on} <strong className="font-semibold">{property.phone}</strong></> : null;
  return (
    <section className="mt-6">
      <h2 className="display text-[1.2rem]">{s.nextTitle}</h2>
      {/*
        A request is not a booking, so this list must not read like one. The old copy — "your
        confirmation email", "you're booked with them" — contradicted the "Request sent" headline
        directly above it, which is the sort of mixed message that has a guest turning up certain
        they had a room.
      */}
      <ul className="mt-4 space-y-2.5">
        {requested ? (
          <>
            <Next>{s.requestNext(property.name)}</Next>
            <Next>{s.requestHeld}</Next>
            <Next>
              {s.requestCall}
              {phone}
              {s.requestCallTail}
            </Next>
          </>
        ) : (
          <>
            <Next>{s.bookedNext}</Next>
            <Next>{paid ? s.bookedArrivePaid(property.checkInTime) : s.bookedArrive(property.checkInTime)}</Next>
            {/* With the manage panel above, "call to change or cancel" would contradict two buttons. */}
            <Next>
              {managed ? s.bookedCallOther : s.bookedCall}
              {phone}
              {managed ? s.bookedCallOtherTail : s.bookedCallTail}
            </Next>
          </>
        )}
      </ul>

      {(property.address || property.phone) && (
        <div className="card mt-5 flex flex-wrap gap-x-8 gap-y-3 p-5 text-[13.5px]">
          {property.address && (
            <p className="flex items-start gap-2">
              <MapPin size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--brand-text))" }} />
              {property.address}
            </p>
          )}
          {property.phone && (
            <p className="flex items-start gap-2">
              <Phone size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--brand-text))" }} />
              <a href={`tel:${property.phone.replace(/\s+/g, "")}`} className="link-quiet font-semibold">
                {property.phone}
              </a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Next({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
      <Check size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--positive))" }} />
      <span>{children}</span>
    </li>
  );
}

function Cell({
  icon, term, value, sub,
}: {
  icon: React.ReactNode;
  term: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="px-5 py-4 sm:px-6" style={{ backgroundColor: "hsl(var(--surface))" }}>
      <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide"
          style={{ color: "hsl(var(--ink-faint))" }}>
        <span style={{ color: "hsl(var(--brand-text))" }}>{icon}</span>
        {term}
      </dt>
      <dd className="mt-1.5 text-[15px] font-bold">{value}</dd>
      <dd className="text-[12px]" style={{ color: "hsl(var(--ink-faint))" }}>{sub}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: "hsl(var(--ink-soft))" }}>{label}</dt>
      <dd className="nums font-semibold">{value}</dd>
    </div>
  );
}
