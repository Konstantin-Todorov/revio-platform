import "server-only";
import { headers } from "next/headers";
import { forSystem, forTenant, teamLocale } from "@revio/db";
import { bookingReference, manageTokenMatches } from "@revio/booking";
import { computeStayCharges, extrasTotalMinor, stayDetails } from "@revio/core";
import { sendEmail, sendTemplatedEmail } from "@revio/email";
import type { PublicProperty } from "./property";

/**
 * The pieces the manage page and its actions share: finding a booking by its reference, checking
 * the key, the address guests reach this site on, and the two mails a change sends.
 */

/** `RV-07NR0F` → the reservation whose id ends in those six characters, on this property. */
export async function findByReference(property: PublicProperty, reference: string) {
  const suffix = reference.replace(/^RV-/i, "").toLowerCase();
  if (!/^[a-z0-9]{6}$/.test(suffix)) return null;
  return forTenant(property.tenantId).reservation.findFirst({
    where: { propertyId: property.id, id: { endsWith: suffix } },
    include: {
      lines: { include: { roomType: true, ratePlan: true } },
      guest: true,
    },
  });
}

export type FoundReservation = NonNullable<Awaited<ReturnType<typeof findByReference>>>;

/** The key from the link — the only thing that lets a visitor change a booking. */
export function mayManage(r: { guestManageToken: string | null }, key: string | null | undefined): boolean {
  return manageTokenMatches(r.guestManageToken, key ?? null);
}

/**
 * Where guests reach THIS site — from the request, because the booking engine answers on the
 * hotel-facing domain (`booking.reviosoft.app`) and a link built from a service variable would point
 * at Railway's internal name. Falls back to the configured origin outside a request.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (process.env.BOOKING_ENGINE_ORIGIN ?? "https://booking.reviosoft.app").replace(/\/+$/, "");
}

export async function manageUrl(property: PublicProperty, reservationId: string, token: string): Promise<string> {
  return `${await siteOrigin()}/${property.slug}/booking/${bookingReference(reservationId)}?k=${encodeURIComponent(token)}`;
}

export function formatMoney(minor: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency }).format(minor / 100);
}

/** The all-in total for a stored reservation — rebuilt the way the confirmation page does it. */
export async function allInTotal(property: PublicProperty, r: FoundReservation): Promise<number> {
  const db = forTenant(property.tenantId);
  const line = r.lines[0];
  if (!line) return 0;
  const nights = Math.round((line.checkOut.getTime() - line.checkIn.getTime()) / 86_400_000);
  const [fees, defaults, extras] = await Promise.all([
    db.taxFee.findMany({ where: { propertyId: property.id, active: true } }),
    db.propertyDefaults.findFirst({ where: { propertyId: property.id } }),
    db.stayExtra.findMany({ where: { reservationId: r.id, active: true }, select: { priceMinor: true, basis: true } }),
  ]);
  return computeStayCharges({
    stay: { accommodationMinor: line.priceMinor ?? 0, nights, rooms: 1, guests: line.guestsCount ?? 2 },
    fees: fees as never,
    cityTaxIncluded: defaults?.cityTaxMode === "included",
    extrasMinor: extrasTotalMinor(extras.map((e) => ({ priceMinor: e.priceMinor, basis: e.basis === "per_stay" ? "per_stay" as const : "per_night" as const })), nights),
  }).totalMinor;
}

/**
 * The guest's own mail about what they just did — the hotel's template, in the language they booked
 * in. Never throws: the change is done whatever the mail provider thinks of it.
 */
export async function mailGuest(
  property: PublicProperty, r: FoundReservation, key: "booking_cancelled" | "booking_modified", cta: { label: string; url: string } | null,
): Promise<void> {
  const to = r.guest?.email?.trim();
  const line = r.lines[0];
  if (!to || !line) return;
  try {
    const locale = r.guestLanguage || property.defaultLanguage || "en";
    const reference = bookingReference(r.id);
    const checkIn = line.checkIn.toISOString().slice(0, 10);
    const checkOut = line.checkOut.toISOString().slice(0, 10);
    const total = key === "booking_modified" ? await allInTotal(property, r) : null;
    await sendTemplatedEmail(forSystem(), {
      propertyId: property.id,
      key,
      to: [to],
      locale,
      vars: {
        guestName: r.guest?.firstName || r.guestName || "",
        propertyName: property.name,
        reference, checkIn, checkOut,
        roomType: line.roomType?.name ?? "",
        checkInTime: property.checkInTime,
        ...(total != null ? { total: formatMoney(total, r.currency, locale) } : {}),
      },
      details: stayDetails({
        locale, reference, roomType: line.roomType?.name ?? "", checkIn, checkOut,
        checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, guests: line.guestsCount ?? null,
        // A cancellation states no total: there is nothing left to pay, and a figure reads as a charge.
        ...(total != null ? { totalMinor: total, currency: r.currency } : {}),
      }),
      ...(cta ? { cta } : {}),
    });
  } catch {
    /* the transport logs; the guest has the result on screen */
  }
}

/**
 * Tell the hotel. A guest changing their own booking is exactly the event a hotel must not learn
 * about from an empty room — so it goes to the reservation mailbox the hotel gave us, in the team's
 * language, beside the audit entry and the CRS notification.
 */
export async function alertHotel(property: PublicProperty, what: "cancelled" | "changed", r: FoundReservation, detail: string): Promise<void> {
  try {
    const p = await forSystem().property.findUnique({
      where: { id: property.id },
      select: { reservationEmailPrimary: true, reservationEmailSecondary: true },
    });
    const to = [p?.reservationEmailPrimary, p?.reservationEmailSecondary].filter((a): a is string => !!a);
    if (to.length === 0) return;
    const bg = (await teamLocale(property.tenantId, to)) === "bg";
    const ref = bookingReference(r.id);
    const who = r.guestName ?? "";
    const subject = bg
      ? `${what === "cancelled" ? "Отказана" : "Променена"} от госта: ${ref} · ${who}`
      : `${what === "cancelled" ? "Cancelled" : "Changed"} by the guest: ${ref} · ${who}`;
    const text = bg
      ? `${who} ${what === "cancelled" ? "отказа" : "промени датите на"} резервация ${ref} от сайта за директни резервации.\n\n${detail}\n\nНаличността вече е обновена навсякъде. Подробностите са в RevioCRS → Резервации.`
      : `${who} ${what === "cancelled" ? "cancelled" : "changed the dates of"} booking ${ref} on your direct booking page.\n\n${detail}\n\nAvailability is already updated everywhere. Details are in RevioCRS → Reservations.`;
    await sendEmail({ to, subject, text });
  } catch {
    /* never blocks the guest */
  }
}
