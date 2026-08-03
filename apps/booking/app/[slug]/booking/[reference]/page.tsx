import { notFound } from "next/navigation";
import { CalendarCheck, Check, Clock, MapPin, Phone } from "lucide-react";
import { forTenant } from "@revio/db";
import { computeStayCharges } from "@revio/core";
import { getPublicProperty, type PublicProperty } from "@/lib/property";
import { fmtDay, money, nightsBetween } from "@/lib/dates";
import { PropertyHeader } from "@/components/PropertyHeader";
import { PropertyFooter } from "@/components/PropertyFooter";
import { StepBar } from "@/components/StepBar";

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
}: {
  params: Promise<{ slug: string; reference: string }>;
}) {
  const { slug, reference } = await params;
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
  const charged = computeStayCharges({
    stay: { accommodationMinor: line.priceMinor ?? 0, nights, rooms: 1, guests: line.guestsCount ?? 2 },
    fees: fees as never,
    cityTaxIncluded: defaults?.cityTaxMode === "included",
  });

  const cancelled = reservation.status === "cancelled";
  // The hotel has not accepted this yet — it happens when they have not finished connecting Stripe,
  // so no card guarantee could be taken and an instant confirmation would be a promise nobody made.
  const requested = reservation.status === "requested";

  return (
    <>
      <PropertyHeader property={property} />

      <main className="mx-auto w-full max-w-[52rem] px-5 pb-20 pt-6 sm:px-8">
        <StepBar current="Confirm" />

        <div className="mt-8 text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={
              cancelled
                ? { backgroundColor: "hsl(var(--caution) / 0.12)", color: "hsl(var(--caution))" }
                : { backgroundColor: "hsl(var(--positive) / 0.12)", color: "hsl(var(--positive))" }
            }
          >
            <Check size={26} strokeWidth={2.6} aria-hidden />
          </span>
          {/*
            Three outcomes, three headlines. A request-to-book is NOT a confirmation and must never
            be dressed as one — the hotel has not accepted it yet, and a guest who reads "You're
            booked" and turns up to nothing has been lied to by a UI copy decision.
          */}
          <h1 className="display mt-5 text-[2rem] sm:text-[2.6rem]">
            {cancelled ? "This booking was cancelled" : requested ? "Request sent" : "You're booked"}
          </h1>
          <p className="mt-3 text-[15px]" style={{ color: "hsl(var(--ink-soft))" }}>
            {cancelled ? (
              <>Contact the hotel if this wasn&rsquo;t what you intended.</>
            ) : requested ? (
              <>
                {property.name} has your request and will confirm by email to{" "}
                <strong style={{ color: "hsl(var(--ink))" }}>{reservation.guest?.email}</strong>. The
                room is held for you in the meantime — nothing has been charged.
              </>
            ) : (
              <>
                We&rsquo;ve sent a confirmation to{" "}
                <strong style={{ color: "hsl(var(--ink))" }}>{reservation.guest?.email}</strong>.
              </>
            )}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold"
             style={{ backgroundColor: "hsl(var(--brand-wash))", color: "hsl(var(--brand-text))" }}>
            Reference {reference.toUpperCase()}
          </p>
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
            <Cell icon={<CalendarCheck size={15} aria-hidden />} term="Check in"
                  value={fmtDay(checkIn)} sub={`from ${property.checkInTime}`} />
            <Cell icon={<CalendarCheck size={15} aria-hidden />} term="Check out"
                  value={fmtDay(checkOut)} sub={`by ${property.checkOutTime}`} />
            <Cell icon={<Clock size={15} aria-hidden />} term="Length"
                  value={`${nights} ${nights === 1 ? "night" : "nights"}`}
                  sub={`${line.guestsCount ?? 2} guests`} />
          </dl>

          <div className="px-5 py-4 sm:px-6">
            <dl className="space-y-1.5 text-[13px]">
              <Row label={`Rooms · ${nights} ${nights === 1 ? "night" : "nights"}`}
                   value={money(charged.accommodationMinor, reservation.currency)} />
              {charged.lines.map((l) => (
                <Row key={l.name} label={l.name} value={money(l.amountMinor, reservation.currency)} />
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t pt-3" style={{ borderColor: "hsl(var(--line))" }}>
              <span className="text-[13.5px] font-semibold">Total to pay at the hotel</span>
              <span className="price text-[1.5rem]">{money(charged.totalMinor, reservation.currency)}</span>
            </div>
            {!cancelled && (
              <p className="mt-2 text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>
                Nothing has been charged
                {reservation.guaranteeLast4 ? ` — your card ending ${reservation.guaranteeLast4} is held as a guarantee only.` : "."}
              </p>
            )}
          </div>
        </section>

        {!cancelled && <WhatNext property={property} requested={requested} />}
      </main>

      <PropertyFooter property={property} />
    </>
  );
}

/** The questions a guest actually has once the booking is done — or once they have asked for it. */
function WhatNext({ property, requested }: { property: PublicProperty; requested: boolean }) {
  return (
    <section className="mt-6">
      <h2 className="display text-[1.2rem]">What happens now</h2>
      {/*
        A request is not a booking, so this list must not read like one. The old copy — "your
        confirmation email", "you're booked with them" — contradicted the "Request sent" headline
        directly above it, which is the sort of mixed message that has a guest turning up certain
        they had a room.
      */}
      <ul className="mt-4 space-y-2.5">
        {requested ? (
          <>
            <Next>
              {property.name} will confirm by email, usually within a few hours. Keep the reference —
              it&rsquo;s all they need to find your request.
            </Next>
            <Next>
              Your room is held until they answer, so nobody else can take it while you wait.
            </Next>
            <Next>
              Changed your mind, or need it sooner? Call them directly
              {property.phone ? <> on <strong className="font-semibold">{property.phone}</strong></> : null} —
              you&rsquo;re dealing with the hotel, not an agency.
            </Next>
          </>
        ) : (
          <>
            <Next>
              Your confirmation email has everything on this page. Keep the reference — it&rsquo;s all the
              hotel needs to find you.
            </Next>
            <Next>
              Arrive any time after {property.checkInTime}. Nothing to print, nothing to pay in advance.
            </Next>
            <Next>
              Need to change or cancel? Call the hotel directly
              {property.phone ? <> on <strong className="font-semibold">{property.phone}</strong></> : null} — you&rsquo;re
              booked with them, not through an agency, so they can just do it.
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
