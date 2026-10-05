import "server-only";
import { forSystem, forTenant } from "@revio/db";
import {
  bookingReference, publicCreateReservation, publicGetHold, publicQuoteStay, voidGroupReservations,
} from "@revio/booking";
import { captureGuestIntent, cancelGuestIntent, createGuestIntent, retrieveGuestIntent } from "@revio/payments";
import { sendTemplatedEmail } from "@revio/email";
import { parseRoomParties, parseRoomPicks, stayDetails, PAY_AT_HOTEL_LABEL, type StayTerms } from "@revio/core";
import type { PublicProperty } from "./property";
import { serverKit } from "./i18n/server";
import { alertHotel, findByReference, formatMoney, manageUrl } from "./manage";
import { nightsBetween } from "./dates";

/**
 * Paying for and writing SEVERAL rooms. Each room is its own reservation (`bookingGroupId`), priced
 * for its own party on its own rate's terms; one card payment covers all of them.
 *
 * Order, as for one room: authorise the total → write every room → capture. If a room cannot be
 * written (the last one went in the seconds between), the rooms already written are voided and the
 * authorisation released — the guest is told nothing was booked, so nothing stays booked.
 */
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "").trim();

export function isGroupForm(fd: FormData): boolean {
  return parseRoomParties(str(fd, "rooms")).length > 1;
}

async function quotes(property: PublicProperty, fd: FormData) {
  const db = forTenant(property.tenantId);
  const rooms = parseRoomParties(str(fd, "rooms"));
  const picks = parseRoomPicks(str(fd, "sel"));
  const holds = str(fd, "holds").split(",").filter(Boolean);
  if (picks.length !== rooms.length || holds.length !== rooms.length) return null;
  const out = [];
  for (let i = 0; i < rooms.length; i++) {
    if (!(await publicGetHold(db, property.id, holds[i]!))) return null;
    const q = await publicQuoteStay(db, { ...property, id: property.id }, {
      checkIn: str(fd, "checkIn"), checkOut: str(fd, "checkOut"),
      guests: rooms[i]!.adults, childAges: rooms[i]!.childAges, promo: str(fd, "promo"),
      roomTypeId: picks[i]!.roomTypeId, ratePlanId: picks[i]!.ratePlanId, holdId: holds[i]!,
    });
    if (!q) return null;
    out.push({ party: rooms[i]!, pick: picks[i]!, holdId: holds[i]!, quote: q });
  }
  return out;
}

export async function startGroupPayment(property: PublicProperty, fd: FormData) {
  const { s } = await serverKit(property);
  const items = await quotes(property, fd);
  if (!items) return { ok: false as const, error: s.errors.holdGone };
  const payNow = items.reduce((n, it) => n + (it.quote.terms?.payNowMinor ?? 0), 0);
  const intent = await createGuestIntent({
    account: property.paymentAccountId,
    kind: payNow > 0 ? "payment" : "setup",
    amountMinor: payNow,
    currency: items[0]!.quote.currency,
    description: `${property.name} · ${items.length} rooms · ${str(fd, "checkIn")} → ${str(fd, "checkOut")}`,
    // The confirm checks the intent is THIS set of holds' payment.
    metadata: { holdId: items.map((i) => i.holdId).join(","), propertyId: property.id, source: "reviodirect" },
    guest: { email: str(fd, "email"), name: `${str(fd, "firstName")} ${str(fd, "lastName")}` },
  });
  if (!intent.ok) return { ok: false as const, error: s.errors.card };
  return { ok: true as const, clientSecret: intent.clientSecret, kind: payNow > 0 ? ("payment" as const) : ("setup" as const) };
}

/** Write every room. Returns the first room's reference to show, or an error to say. */
export async function confirmGroup(
  property: PublicProperty, fd: FormData,
  guest: { firstName: string; lastName: string; email: string; phone: string },
  locale: string,
): Promise<{ ok: true; reference: string; manageToken: string | null } | { ok: false; error: string }> {
  const { s } = await serverKit(property);
  const e = s.errors;
  const db = forTenant(property.tenantId);
  const items = await quotes(property, fd);
  if (!items) return { ok: false, error: e.holdGone };
  const requestOnly = !property.paymentReady;
  const holdsKey = items.map((i) => i.holdId).join(",");
  const payNow = items.reduce((n, it) => n + (it.quote.terms?.payNowMinor ?? 0), 0);

  let guarantee: { ref: string; brand?: string; last4?: string } | null = null;
  let intentId = "", customerId: string | null = null, intentKind: "payment" | "setup" = "setup";
  if (!requestOnly) {
    intentId = str(fd, "intentId");
    const intent = intentId ? await retrieveGuestIntent(intentId, property.paymentAccountId) : null;
    const ok = !!intent && intent.metadata.holdId === holdsKey && intent.metadata.propertyId === property.id &&
      (intent.kind === "setup"
        ? intent.status === "succeeded" && payNow === 0
        : intent.status === "requires_capture" && intent.capturableMinor === payNow && intent.currency === items[0]!.quote.currency);
    if (!ok) {
      if (intent?.kind === "payment") await cancelGuestIntent(intentId, property.paymentAccountId);
      return { ok: false, error: intent?.kind === "payment" && intent.capturableMinor !== payNow ? e.priceMoved : e.card };
    }
    intentKind = intent!.kind;
    customerId = intent!.customerId;
    guarantee = { ref: intent!.paymentMethodId ?? intentId, ...(intent!.brand ? { brand: intent!.brand } : {}), ...(intent!.last4 ? { last4: intent!.last4 } : {}) };
  }

  const scoped = { ...property, id: property.id };
  const written: { id: string; manageToken: string | null; roomTypeName: string; totalMinor: number; party: (typeof items)[number]["party"] }[] = [];
  let groupId: string | undefined;
  for (const it of items) {
    const paid = intentKind === "payment" ? it.quote.terms?.payNowMinor ?? 0 : 0;
    const result = await publicCreateReservation(db, scoped, {
      checkIn: str(fd, "checkIn"), checkOut: str(fd, "checkOut"),
      guests: it.party.adults, childAges: it.party.childAges, promo: str(fd, "promo"),
      roomTypeId: it.pick.roomTypeId, ratePlanId: it.pick.ratePlanId,
      guest: { firstName: guest.firstName, lastName: guest.lastName, email: guest.email, ...(guest.phone ? { phone: guest.phone } : {}) },
      holdId: it.holdId,
      ...(groupId ? { bookingGroupId: groupId } : {}),
      ...(guarantee ? { guarantee } : {}),
      ...(!requestOnly ? { payment: { intentId, paidMinor: paid, accountId: property.paymentAccountId, customerId } } : {}),
      ...(it.quote.terms ? { terms: it.quote.terms as StayTerms } : {}),
      requestOnly,
      guestNote: str(fd, "note"),
      guestLanguage: locale,
    });
    if (result.error || !result.reservationId) {
      // One room could not be written: undo the others and release the money, then say so.
      await voidGroupReservations(db, scoped, written.map((w) => w.id));
      if (!requestOnly && intentKind === "payment") await cancelGuestIntent(intentId, property.paymentAccountId);
      return { ok: false, error: result.code ? e.booking[result.code] : e.generic };
    }
    if (!groupId) {
      groupId = result.reservationId;
      await db.reservation.update({ where: { id: groupId }, data: { bookingGroupId: groupId } });
    }
    written.push({ id: result.reservationId, manageToken: result.manageToken ?? null, roomTypeName: result.roomTypeName ?? "", totalMinor: result.totalMinor ?? 0, party: it.party });
  }

  if (!requestOnly && intentKind === "payment" && payNow > 0) {
    const captured = await captureGuestIntent(intentId, property.paymentAccountId);
    if (!captured.ok) {
      await db.reservation.updateMany({ where: { id: { in: written.map((w) => w.id) } }, data: { onlinePaidMinor: 0 } });
    }
  }

  // One email for the whole booking: every room, its dates and its total, then the group total.
  const currency = property.baseCurrency;
  const fmt = (m: number) => formatMoney(m, currency, locale);
  const first = written[0]!;
  const reference = bookingReference(first.id);
  try {
    const details = written.flatMap((w, i) => [
      { label: locale === "bg" ? `Стая ${i + 1}` : `Room ${i + 1}`, value: `${w.roomTypeName} · ${bookingReference(w.id)}`, emphasis: true },
      ...stayDetails({
        locale, reference: bookingReference(w.id), roomType: w.roomTypeName, checkIn: str(fd, "checkIn"), checkOut: str(fd, "checkOut"),
        guests: w.party.adults + w.party.childAges.length, totalMinor: w.totalMinor, currency,
      }).filter((d) => !/reference|номер|accommodation|настаняване в/i.test(d.label)),
    ]);
    const groupTotal = written.reduce((n, w) => n + w.totalMinor, 0);
    await sendTemplatedEmail(forSystem(), {
      propertyId: property.id,
      key: requestOnly ? "booking_requested" : "booking_confirmation",
      to: [guest.email],
      locale,
      vars: {
        guestName: guest.firstName, propertyName: property.name,
        checkIn: str(fd, "checkIn"), checkOut: str(fd, "checkOut"),
        nights: String(nightsBetween(str(fd, "checkIn"), str(fd, "checkOut"))),
        roomType: written.map((w) => w.roomTypeName).join(", "), reference, total: fmt(groupTotal),
      },
      details: [...details, {
        label: locale === "bg" ? "Общо за всички стаи" : "Total for all rooms",
        value: payNow > 0 ? `${fmt(groupTotal)} · ${locale === "bg" ? "платено сега" : "paid now"} ${fmt(payNow)}` : `${fmt(groupTotal)} · ${PAY_AT_HOTEL_LABEL[locale] ?? PAY_AT_HOTEL_LABEL.en}`,
        emphasis: true,
      }],
      ...(first.manageToken ? { cta: { label: s.manage.linkEmailCta, url: await manageUrl(property, first.id, first.manageToken) } } : {}),
    });
  } catch {
    /* the guest already has the confirmation on screen */
  }
  for (const w of written) {
    const r = await findByReference(property, bookingReference(w.id));
    if (r) {
      await alertHotel(property, requestOnly ? "requested" : "new", r, [
        { en: `Part of a ${written.length}-room booking (${reference})`, bg: `Част от резервация за ${written.length} стаи (${reference})` },
      ]);
    }
  }
  return { ok: true, reference, manageToken: first.manageToken };
}
