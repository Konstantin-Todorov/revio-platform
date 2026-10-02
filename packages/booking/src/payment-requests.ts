import { randomBytes } from "node:crypto";
import type { forTenant, forSystem } from "@revio/db";

type Db = ReturnType<typeof forTenant> | ReturnType<typeof forSystem>;

/**
 * A payment the hotel asks a guest for after booking, paid on RevioDirect with a private link.
 *
 * The hotel's desk creates it (RevioCRS → the reservation → Request a payment); the guest gets the
 * hotel's own email with a button; the page takes the card on the HOTEL's Stripe account. The amount
 * is fixed when the request is made — the guest pays exactly what the hotel asked, never a number the
 * page computed.
 *
 * Valid for 14 days, so a forgotten link cannot be paid months later against a stay that changed.
 */
export const PAYMENT_REQUEST_DAYS = 14;

export async function createPaymentRequest(
  db: Db,
  input: {
    tenantId: string; propertyId: string; reservationId: string;
    amountMinor: number; currency: string; note: string | null; createdByName: string | null;
  },
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + PAYMENT_REQUEST_DAYS * 86_400_000);
  const row = await db.paymentRequest.create({
    data: { ...input, token, expiresAt, note: input.note?.trim().slice(0, 200) || null },
    select: { id: true },
  });
  return { id: row.id, token, expiresAt };
}

export type PaymentRequestState = "open" | "paid" | "cancelled" | "expired";

/** What a request is NOW: an open one past its date is expired, whatever the column says. */
export function paymentRequestState(r: { status: string; expiresAt: Date }, now = new Date()): PaymentRequestState {
  if (r.status === "paid" || r.status === "cancelled") return r.status;
  return r.expiresAt.getTime() < now.getTime() ? "expired" : "open";
}

/**
 * Mark it paid — only if it is still open and the intent is exactly this request, for exactly its
 * amount, succeeded on the hotel's account. Conditional on `status = open`, so a double submit or a
 * retried request records one payment.
 */
export async function completePaymentRequest(
  db: Db,
  request: { id: string; amountMinor: number; currency: string },
  intent: { id: string; status: string; amountMinor: number; currency: string; metadata: Record<string, string>; last4: string | null },
  accountId: string | null,
): Promise<{ ok: true } | { ok: false; reason: "mismatch" | "not_paid" | "already" }> {
  if (intent.status !== "succeeded") return { ok: false, reason: "not_paid" };
  if (intent.metadata.paymentRequestId !== request.id || intent.amountMinor !== request.amountMinor
      || intent.currency.toUpperCase() !== request.currency.toUpperCase()) {
    return { ok: false, reason: "mismatch" };
  }
  const { count } = await db.paymentRequest.updateMany({
    where: { id: request.id, status: "open" },
    data: { status: "paid", paidAt: new Date(), paymentRef: intent.id, paymentAccountId: accountId, cardLast4: intent.last4 },
  });
  return count === 1 ? { ok: true } : { ok: false, reason: "already" };
}
