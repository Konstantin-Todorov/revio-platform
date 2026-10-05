import "server-only";
import { headers } from "next/headers";
import { forSystem, forTenant, teamLocale } from "@revio/db";
import { bookingReference, manageTokenMatches, storedStayTotal } from "@revio/booking";
import { hotelAlertRecipients, stayDetails } from "@revio/core";
import { sendEmail, sendTemplatedEmail } from "@revio/email";
import type { PublicProperty } from "./property";
import { productOrigin } from "@revio/ui/product-links";

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

/**
 * The key from the link — the only thing that lets a visitor change a booking. For rooms booked
 * together, the key of the FIRST room (the one in the confirmation email) opens every room of the
 * group: the guest booked them as one, and one link is what they were given.
 */
export async function mayManage(
  r: { guestManageToken: string | null; bookingGroupId?: string | null; id?: string; tenantId?: string },
  key: string | null | undefined,
): Promise<boolean> {
  if (manageTokenMatches(r.guestManageToken, key ?? null)) return true;
  if (!r.bookingGroupId || !r.tenantId || r.bookingGroupId === r.id) return false;
  const leader = await forTenant(r.tenantId).reservation.findFirst({
    where: { id: r.bookingGroupId },
    select: { guestManageToken: true },
  });
  return manageTokenMatches(leader?.guestManageToken ?? null, key ?? null);
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

/** The all-in total for a stored reservation — the shared implementation, see `storedStayTotal`. */
export async function allInTotal(property: PublicProperty, r: FoundReservation): Promise<number> {
  return (await storedStayTotal(forTenant(property.tenantId), r.id))?.totalMinor ?? 0;
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
 * Tell the hotel. A booking arriving on the hotel's own page — or a guest changing one — is exactly
 * the event a hotel must not learn about from an empty room or a guest at the desk. So it goes to
 * the reservation mailbox the hotel gave us, in the team's language, beside the audit entry and the
 * CRS notification. A REQUEST says so in its subject: nothing happens until somebody accepts it.
 */
export type HotelAlert = "new" | "requested" | "cancelled" | "changed" | "paid";

/** One extra line for the hotel's mail, in both team languages — the mail picks one. */
export type AlertLine = { en: string; bg: string };

export async function alertHotel(property: PublicProperty, what: HotelAlert, r: FoundReservation, extra: AlertLine[] = []): Promise<void> {
  try {
    const p = await forSystem().property.findUnique({
      where: { id: property.id },
      select: { reservationEmailPrimary: true, reservationEmailSecondary: true, contactEmail: true },
    });
    const owners = p?.reservationEmailPrimary || p?.reservationEmailSecondary || p?.contactEmail
      ? []
      : (await forSystem().user.findMany({ where: { tenantId: property.tenantId, role: "owner", active: true }, select: { email: true } })).map((u) => u.email);
    const to = hotelAlertRecipients({ primary: p?.reservationEmailPrimary, secondary: p?.reservationEmailSecondary, contact: p?.contactEmail, owners });
    if (to.length === 0) return;
    const bg = (await teamLocale(property.tenantId, to)) === "bg";
    const ref = bookingReference(r.id);
    const who = r.guestName ?? "";
    const link = `${productOrigin("crs")}/reservations/${r.id}`;
    const subjects = {
      new: bg ? `Нова директна резервация: ${ref} · ${who}` : `New direct booking: ${ref} · ${who}`,
      requested: bg ? `Заявка за потвърждение: ${ref} · ${who}` : `Booking request to confirm: ${ref} · ${who}`,
      cancelled: bg ? `Отказана от госта: ${ref} · ${who}` : `Cancelled by the guest: ${ref} · ${who}`,
      changed: bg ? `Променена от госта: ${ref} · ${who}` : `Changed by the guest: ${ref} · ${who}`,
      paid: bg ? `Получено плащане по връзка: ${ref} · ${who}` : `Payment received by link: ${ref} · ${who}`,
    };
    const leads = {
      new: bg ? `${who} резервира от сайта Ви за директни резервации.` : `${who} booked on your direct booking page.`,
      requested: bg
        ? `${who} изпрати заявка от сайта Ви за директни резервации. Стаята е задържана, но резервацията НЕ е потвърдена — потвърдете или откажете я в RevioCRS.`
        : `${who} sent a request on your direct booking page. The room is held, but the booking is NOT confirmed — accept or decline it in RevioCRS.`,
      cancelled: bg ? `${who} отказа резервация ${ref} от сайта за директни резервации.` : `${who} cancelled booking ${ref} on your direct booking page.`,
      changed: bg ? `${who} промени датите на резервация ${ref} от сайта за директни резервации.` : `${who} changed the dates of booking ${ref} on your direct booking page.`,
      paid: bg ? `${who} плати по връзката за плащане, която изпратихте. Парите са във Вашия Stripe акаунт.` : `${who} paid the payment link you sent. The money is in your Stripe account.`,
    };
    const subject = subjects[what];
    const line = r.lines[0];
    const day = (d: Date) => d.toLocaleDateString(bg ? "bg-BG" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const facts = line
      ? [
          `${bg ? "Престой" : "Stay"}: ${day(line.checkIn)} → ${day(line.checkOut)}`,
          `${bg ? "Стая" : "Room"}: ${line.roomType?.name ?? ""}${line.ratePlan?.name ? ` · ${line.ratePlan.name}` : ""}`,
          `${bg ? "Гости" : "Guests"}: ${line.guestsCount ?? ""}`,
          ...(what === "cancelled" || what === "paid" ? [] : [`${bg ? "Общо" : "Total"}: ${formatMoney(await allInTotal(property, r), r.currency, bg ? "bg" : "en")}`]),
          ...(r.guest?.email ? [`E-mail: ${r.guest.email}`] : []),
          ...(r.guest?.phone ? [`${bg ? "Телефон" : "Phone"}: ${r.guest.phone}`] : []),
        ]
      : [];
    const text = [
      leads[what],
      "",
      ...facts,
      ...extra.map((x) => (bg ? x.bg : x.en)),
      "",
      bg ? "Наличността вече е обновена навсякъде." : "Availability is already updated everywhere.",
      bg ? `Отворете резервацията: ${link}` : `Open the booking: ${link}`,
    ].join("\n");
    await sendEmail({ to, subject, text });
  } catch {
    /* never blocks the guest */
  }
}
