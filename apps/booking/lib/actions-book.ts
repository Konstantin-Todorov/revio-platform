"use server";

import { redirect } from "next/navigation";
import { forTenant } from "@revio/db";
import { bookingReference, publicCreateReservation, publicGetHold, publicQuoteStay, publicReleaseHold } from "@revio/booking";
import { cancelGuestIntent, captureGuestIntent, createGuestIntent, retrieveGuestIntent } from "@revio/payments";
import { sendTemplatedEmail } from "@revio/email";
import { PAY_AT_HOTEL_LABEL, stayDetails, type StayTerms } from "@revio/core";
import { claimSubmitToken, forSystem } from "@revio/db";
import { serverKit } from "./i18n/server";
import { getPublicProperty } from "./property";
import { nightsBetween } from "./dates";

/**
 * Confirming a booking.
 *
 * Everything is re-derived server-side. The form carries dates, a room and a rate, but never a
 * price: the quote is recomputed from the same engine the results page used, so a tampered field
 * changes what is booked, never what is charged. That is the whole reason the hidden inputs are
 * identifiers rather than amounts.
 */

export interface BookResult {
  ok: boolean;
  error?: string;
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "").trim();

export type StartPaymentResult =
  | { ok: true; clientSecret: string; kind: "payment" | "setup" }
  | { ok: false; error: string };

/**
 * Step one of paying: ask Stripe, on the HOTEL's account, for an intent to confirm in the browser.
 *
 * The amount is re-derived here — the quote with the chosen extras, and the rate's terms on it —
 * never taken from the page. A payment intent only authorises (`capture_method=manual`); nothing is
 * taken until `confirmBooking` has written the reservation. Everything the guest typed is checked
 * FIRST, so a missing email is said before a card is authorised rather than after.
 */
export async function startCardPayment(fd: FormData): Promise<StartPaymentResult> {
  const property = await getPublicProperty(str(fd, "slug"));
  if (!property || !property.paymentReady) return { ok: false, error: "This booking page isn't available." };
  const { s } = await serverKit(property);
  const e = s.errors;
  if (!str(fd, "firstName") || !str(fd, "lastName")) return { ok: false, error: e.name };
  if (!/.+@.+\..+/.test(str(fd, "email"))) return { ok: false, error: e.email };
  if (fd.get("acceptTerms") == null) return { ok: false, error: e.terms };

  const db = forTenant(property.tenantId);
  const holdId = str(fd, "holdId");
  if (!holdId || !(await publicGetHold(db, property.id, holdId))) return { ok: false, error: e.holdGone };

  const quote = await publicQuoteStay(db, { ...property, id: property.id }, stayOf(fd));
  if (!quote) return { ok: false, error: e.generic };
  const payNow = quote.terms?.payNowMinor ?? 0;
  const intent = await createGuestIntent({
    account: property.paymentAccountId,
    kind: payNow > 0 ? "payment" : "setup",
    amountMinor: payNow,
    currency: quote.currency,
    description: `${property.name} · ${str(fd, "checkIn")} → ${str(fd, "checkOut")}`,
    // What the confirm step checks the intent against — it must be THIS hold's payment.
    metadata: { holdId, propertyId: property.id, ratePlanId: str(fd, "ratePlanId"), source: "reviodirect" },
  });
  if (!intent.ok) return { ok: false, error: e.card };
  return { ok: true, clientSecret: intent.clientSecret, kind: payNow > 0 ? "payment" : "setup" };
}

/** The stay a form describes — identifiers only; every amount is derived from them. */
function stayOf(fd: FormData) {
  const guests = Number.parseInt(str(fd, "guests") || "2", 10);
  return {
    checkIn: str(fd, "checkIn"),
    checkOut: str(fd, "checkOut"),
    guests: Number.isFinite(guests) ? guests : 0,
    roomTypeId: str(fd, "roomTypeId"),
    ratePlanId: str(fd, "ratePlanId"),
    holdId: str(fd, "holdId"),
    extraIds: fd.getAll("extraIds").filter((v): v is string => typeof v === "string"),
  };
}

export async function confirmBooking(_prev: BookResult | null, fd: FormData): Promise<BookResult> {
  const slug = str(fd, "slug");
  const property = await getPublicProperty(slug);
  // Same generic answer as everywhere else on this app — never leak whether a hotel exists.
  if (!property) return { ok: false, error: "This booking page isn't available." };

  // Everything this action says is in the guest's language — the same one the page was in.
  const { s, locale } = await serverKit(property);
  const e = s.errors;
  const db = forTenant(property.tenantId);
  const scoped = { ...property, id: property.id };

  const holdId = str(fd, "holdId");
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const email = str(fd, "email");
  const phone = str(fd, "phone");

  if (!firstName || !lastName) return { ok: false, error: e.name };
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: e.email };
  if (fd.get("acceptTerms") == null) {
    return { ok: false, error: e.terms };
  }

  // The hold is the guest's claim on the room. If it expired while they were typing, say so plainly
  // and send them back to a fresh search rather than silently booking something else.
  if (holdId && !(await publicGetHold(db, property.id, holdId))) {
    return {
      ok: false,
      error: e.holdGone,
    };
  }

  /**
   * The card guarantee — but only when the hotel can actually take one.
   *
   * `paymentReady` mirrors Stripe's `charges_enabled` on the hotel's OWN connected account. Until
   * that is true there is no account to authorise against, so taking a "guarantee" would mean
   * storing a token nobody can ever capture: the front desk would read *card on file* and find
   * nothing behind it on the night a guest failed to arrive. So the engine falls back to
   * **request-to-book** — no card, and the hotel accepts the stay itself.
   *
   * Decided ONCE, here, and passed down. Reading `paymentReady` again further in would risk a
   * booking that tells the guest "confirmed" and the hotel "please review".
   */
  const requestOnly = !property.paymentReady;

  /*
   * One booking per press. Before the card guarantee on purpose: a second arrival of the same form
   * (a double tap before the page hydrated, a retried request) must not create a second guarantee
   * either. The hold already refuses a second booking, but with "the hold expired" — read by the
   * guest as a failure while their booking in fact exists — so a duplicate goes to the list instead.
   */
  if (!(await claimSubmitToken(db, fd, property.tenantId, "confirmBooking"))) {
    redirect(`/${property.slug}`);
  }

  /*
   * The card, verified with Stripe — never with the page. The browser confirmed an intent that
   * `startCardPayment` created; here we fetch it back from the hotel's account and check it is THIS
   * hold's, in the state that step leaves it, for exactly what the stay costs now. Anything else is
   * refused and the authorisation released, so the guest is never charged for a booking that did
   * not happen.
   */
  let guarantee: { ref: string; brand?: string; last4?: string } | null = null;
  let payment: { intentId: string; paidMinor: number; accountId: string | null } | null = null;
  let terms: StayTerms | null = null;
  if (!requestOnly) {
    const intentId = str(fd, "intentId");
    const quote = await publicQuoteStay(db, scoped, stayOf(fd));
    const intent = intentId ? await retrieveGuestIntent(intentId, property.paymentAccountId) : null;
    const payNow = quote?.terms?.payNowMinor ?? 0;
    const ok =
      !!quote && !!intent && intent.metadata.holdId === holdId && intent.metadata.propertyId === property.id &&
      (intent.kind === "setup"
        ? intent.status === "succeeded" && payNow === 0
        : intent.status === "requires_capture" && intent.capturableMinor === payNow && intent.currency === quote.currency);
    if (!ok) {
      if (intent?.kind === "payment") await cancelGuestIntent(intentId, property.paymentAccountId);
      return { ok: false, error: quote && intent && intent.kind === "payment" && intent.capturableMinor !== payNow ? e.priceMoved : e.card };
    }
    guarantee = { ref: intent!.paymentMethodId ?? intentId, ...(intent!.brand ? { brand: intent!.brand } : {}), ...(intent!.last4 ? { last4: intent!.last4 } : {}) };
    if (intent!.kind === "payment") payment = { intentId, paidMinor: payNow, accountId: property.paymentAccountId };
    terms = quote!.terms;
  }

  /*
   * The party size drives occupancy pricing, so an unreadable one must be REFUSED rather than
   * defaulted. This read `Number.parseInt(str(fd, "guests") || "2", 10)`: absent gave 2, but
   * `guests=abc` on this — the one public, unauthenticated, inventory-touching surface we have —
   * gave `NaN`, which survived only because `validStay` rejects it one package away. That is a
   * guard we do not own and did not state. Defaulting instead would be worse than the NaN: a
   * tampered post would quietly book and price a stay for two that nobody asked for.
   */
  const guestsRaw = str(fd, "guests");
  const guestCount = guestsRaw === "" ? 2 : Number.parseInt(guestsRaw, 10);
  if (!Number.isFinite(guestCount)) {
    return { ok: false, error: e.guests };
  }

  const result = await publicCreateReservation(db, scoped, {
    checkIn: str(fd, "checkIn"),
    checkOut: str(fd, "checkOut"),
    guests: guestCount,
    roomTypeId: str(fd, "roomTypeId"),
    ratePlanId: str(fd, "ratePlanId"),
    guest: { firstName, lastName, email, ...(phone ? { phone } : {}) },
    ...(holdId ? { holdId } : {}),
    ...(guarantee ? { guarantee } : {}),
    ...(payment ? { payment } : {}),
    ...(terms ? { terms } : {}),
    requestOnly,
    // Ids only. Everything about what they cost is re-derived server-side from the hotel's
    // catalogue, so a tampered checkbox changes what is booked, never what is paid.
    extraIds: fd.getAll("extraIds").filter((v): v is string => typeof v === "string"),
    guestNote: str(fd, "note"),
    // Every later mail to this guest follows the language they booked in.
    guestLanguage: locale,
  });

  if (result.error || !result.reservationId) {
    // Nothing was booked, so nothing may be taken: release the authorisation before saying so.
    if (payment) await cancelGuestIntent(payment.intentId, payment.accountId);
    // By code, never by the engine's English sentence.
    return { ok: false, error: result.code ? e.booking[result.code] : e.generic };
  }

  const reference = bookingReference(result.reservationId);

  /*
   * The reservation exists — now take the money. If Stripe refuses the capture (vanishingly rare
   * after a successful authorisation) the booking stands and the hotel sees no online payment on it,
   * because a stay the guest was told is booked must not silently disappear.
   */
  if (payment) {
    const captured = await captureGuestIntent(payment.intentId, payment.accountId);
    if (!captured.ok) {
      await db.reservation.update({ where: { id: result.reservationId }, data: { onlinePaidMinor: 0 } });
    }
  }

  /**
   * The confirmation. Uses the hotel's OWN template and branding — the same engine RevioLink sends
   * from — so a guest who books direct gets the hotel's mail, not the platform's.
   *
   * Never blocks the booking. The room is already theirs; a mail provider having a bad minute must
   * not turn a completed reservation into an error page, and the reference is on screen either way.
   */
  try {
    await sendTemplatedEmail(forSystem(), {
      propertyId: property.id,
      // A request is not a booking: it says so, and the confirmation follows when the hotel accepts.
      key: requestOnly ? "booking_requested" : "booking_confirmation",
      to: [email],
      locale,
      vars: {
        guestName: firstName,
        propertyName: property.name,
        checkIn: str(fd, "checkIn"),
        checkOut: str(fd, "checkOut"),
        nights: String(nightsBetween(str(fd, "checkIn"), str(fd, "checkOut"))),
        roomType: result.roomTypeName ?? "",
        reference,
        total: formatMoney(result.totalMinor ?? 0, result.currency ?? property.baseCurrency, locale),
      },
      // The stay, itemised the same way the confirmation page shows it — in the email's own language,
      // labels, dates and money included (`stayDetails`). It was hard-coded English, so a Bulgarian
      // confirmation arrived with an English middle.
      details: stayDetails({
        locale,
        reference,
        roomType: result.roomTypeName ?? "",
        checkIn: str(fd, "checkIn"),
        checkOut: str(fd, "checkOut"),
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        guests: guestCount,
        totalMinor: result.totalMinor ?? 0,
        currency: result.currency ?? property.baseCurrency,
        // "Pay at the hotel" is only true when nothing was taken online.
        totalLabel: payment
          ? (locale === "bg"
              ? `Общо · платено сега ${formatMoney(payment.paidMinor, property.baseCurrency, locale)}`
              : `Total · paid now ${formatMoney(payment.paidMinor, property.baseCurrency, locale)}`)
          : PAY_AT_HOTEL_LABEL[locale] ?? PAY_AT_HOTEL_LABEL.en!,
      }),
    });
  } catch {
    /* logged by the transport; the guest already has their confirmation on screen */
  }

  // Outside any try/catch on purpose: `redirect` throws by design in Next, and swallowing it would
  // leave the guest sitting on the form after their booking had already succeeded.
  redirect(`/${property.slug}/booking/${reference}`);
}

/** Abandoning the form. Best-effort — the hold expires on its own if this never runs. */
export async function abandonHold(fd: FormData): Promise<void> {
  const slug = str(fd, "slug");
  const holdId = str(fd, "holdId");
  const property = await getPublicProperty(slug);
  if (!property) return;
  if (holdId) await publicReleaseHold(forTenant(property.tenantId), property.id, holdId);
  redirect(`/${property.slug}`);
}

/** Money for an email body — plain text, so no HTML entities and no locale surprises. */
function formatMoney(minor: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency }).format(minor / 100);
}
