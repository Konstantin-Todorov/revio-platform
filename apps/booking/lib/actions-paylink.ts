"use server";

import { forTenant } from "@revio/db";
import { completePaymentRequest, paymentRequestState } from "@revio/booking";
import { createGuestIntent, retrieveGuestIntent } from "@revio/payments";
import { getPublicProperty } from "./property";
import { serverKit } from "./i18n/server";
import { alertHotel, findByReference, formatMoney } from "./manage";
import { bookingReference } from "@revio/booking";

/**
 * Paying a link the hotel sent. The amount is the REQUEST's, never the page's: the server reads the
 * request by its token, creates the intent for exactly that amount on the hotel's account, and on
 * return checks the intent is this request's, for that amount, and succeeded before marking it paid.
 */
async function load(slug: string, token: string) {
  const property = await getPublicProperty(slug);
  if (!property) return null;
  const db = forTenant(property.tenantId);
  const req = await db.paymentRequest.findFirst({
    where: { token, propertyId: property.id },
    include: { reservation: { include: { guest: true } } },
  });
  if (!req) return null;
  return { property, db, req };
}

export async function startLinkPayment(slug: string, token: string): Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> {
  const found = await load(slug, token);
  const { s } = found ? await serverKit(found.property) : { s: null };
  if (!found || !s) return { ok: false, error: "Not found" };
  const { property, req } = found;
  if (paymentRequestState(req) !== "open") return { ok: false, error: s.pay.notOpen };
  if (!property.paymentReady) return { ok: false, error: s.pay.notReady };
  const intent = await createGuestIntent({
    account: property.paymentAccountId,
    kind: "payment",
    mode: "charge",
    amountMinor: req.amountMinor,
    currency: req.currency,
    description: `${property.name} · ${bookingReference(req.reservationId)}${req.note ? ` · ${req.note}` : ""}`,
    metadata: { paymentRequestId: req.id, reservationId: req.reservationId, source: "reviodirect-link" },
    guest: { email: req.reservation.guest?.email ?? "", name: req.reservation.guestName ?? "" },
  });
  if (!intent.ok) return { ok: false, error: intent.error };
  return { ok: true, clientSecret: intent.clientSecret };
}

export async function confirmLinkPayment(slug: string, token: string, intentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await load(slug, token);
  if (!found) return { ok: false, error: "Not found" };
  const { property, db, req } = found;
  const { s } = await serverKit(property);
  const intent = await retrieveGuestIntent(intentId, property.paymentAccountId);
  if (!intent) return { ok: false, error: s.pay.failed };
  const res = await completePaymentRequest(db, req, { id: intentId, ...intent }, property.paymentAccountId);
  if (!res.ok && res.reason !== "already") return { ok: false, error: s.pay.failed };
  if (res.ok) {
    const r = await findByReference(property, bookingReference(req.reservationId));
    if (r) {
      const m = (l: string) => formatMoney(req.amountMinor, req.currency, l);
      await alertHotel(property, "paid", r, [
        { en: `Paid by payment link: ${m("en")}${req.note ? ` (${req.note})` : ""}`, bg: `Платено по връзка: ${m("bg")}${req.note ? ` (${req.note})` : ""}` },
      ]);
    }
  }
  return { ok: true };
}
