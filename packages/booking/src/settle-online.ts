import { cancellationSettlement, noShowSettlement, type Settlement, type StayTerms } from "@revio/core";
import { chargeSavedCard, refundGuestPayment } from "@revio/payments";
import type { forTenant } from "@revio/db";

type Db = ReturnType<typeof forTenant>;

/**
 * Money after a RevioDirect booking ends early — a cancellation or a no-show — settled by the terms
 * the guest agreed to (`Reservation.stayTerms`, frozen at booking), on the hotel's own Stripe account.
 *
 * `cancellationSettlement` / `noShowSettlement` in core decide the amounts; this moves them: the
 * difference goes back to the guest or onto the saved card, never both. Each movement carries an
 * idempotency key per reservation, so pressing Cancel twice (or a retried request) moves money once.
 * `waive` is the hotel's choice to forgive the fee — then everything paid comes back.
 *
 * Shared by RevioCRS (staff cancel / no-show) and RevioDirect (the guest cancelling their own
 * booking): the same terms must move the same money whoever pressed the button, and two copies of
 * this would be the second copy that forgets the idempotency key.
 */
export interface SettledOnline extends Settlement {
  refunded: boolean;
  charged: boolean;
  error?: string;
}

export function previewSettlement(
  r: { stayTerms: unknown; onlinePaidMinor: number | null },
  kind: "cancel" | "no_show",
  today: string,
): Settlement | null {
  const terms = r.stayTerms as StayTerms | null;
  if (!terms) return null;
  const paid = r.onlinePaidMinor ?? 0;
  return kind === "cancel" ? cancellationSettlement(terms, today, paid) : noShowSettlement(terms, paid);
}

export async function settleOnline(
  db: Db,
  reservationId: string,
  kind: "cancel" | "no_show",
  today: string,
  waive: boolean,
): Promise<SettledOnline | null> {
  const r = await db.reservation.findFirst({
    where: { id: reservationId },
    select: {
      id: true, currency: true, stayTerms: true, onlinePaidMinor: true, onlinePaymentRef: true,
      balancePaymentRef: true, balanceChargeMinor: true, balanceChargedAt: true,
      paymentAccountId: true, paymentCustomerId: true, guaranteeRef: true,
      feeChargedMinor: true, refundedOnlineMinor: true,
    },
  });
  if (!r) return null;
  const base = previewSettlement(r, kind, today);
  if (!base) return null;
  // Already settled once — a second press must not move money again.
  if ((r.feeChargedMinor ?? 0) > 0 || (r.refundedOnlineMinor ?? 0) > 0) {
    return { ...base, refundMinor: 0, chargeMinor: 0, refunded: false, charged: false };
  }
  const paid = r.onlinePaidMinor ?? 0;
  const s: Settlement = waive ? { feeMinor: 0, refundMinor: paid, chargeMinor: 0 } : base;

  let refunded = false, charged = false, error: string | undefined;

  if (s.refundMinor > 0) {
    // The booking payment first, then the balance taken later — each only up to what it carried.
    const balancePaid = r.balanceChargedAt && r.balancePaymentRef ? r.balanceChargeMinor ?? 0 : 0;
    const fromBooking = Math.min(s.refundMinor, paid - balancePaid);
    const fromBalance = s.refundMinor - fromBooking;
    const parts: [string | null, number, string][] = [
      [r.onlinePaymentRef?.startsWith("pi_") ? r.onlinePaymentRef : null, fromBooking, "booking"],
      [r.balancePaymentRef, fromBalance, "balance"],
    ];
    refunded = true;
    for (const [intentId, amount, part] of parts) {
      if (!intentId || amount <= 0) continue;
      const res = await refundGuestPayment({
        account: r.paymentAccountId, intentId, amountMinor: amount, idempotencyKey: `refund-${kind}-${part}-${r.id}`,
      });
      if (!res.ok) { refunded = false; error = res.error; }
    }
  }

  if (s.chargeMinor > 0 && r.paymentCustomerId && r.guaranteeRef?.startsWith("pm_")) {
    const res = await chargeSavedCard({
      account: r.paymentAccountId,
      customerId: r.paymentCustomerId,
      paymentMethodId: r.guaranteeRef,
      amountMinor: s.chargeMinor,
      currency: r.currency,
      description: kind === "cancel" ? "Cancellation fee" : "No-show fee",
      metadata: { reservationId: r.id, kind, source: "reviodirect" },
      idempotencyKey: `${kind}-fee-${r.id}`,
    });
    charged = res.ok;
    if (!res.ok) error = `${res.reason}: ${res.message}`;
  }

  await db.reservation.update({
    where: { id: r.id },
    data: {
      ...(charged ? { feeChargedMinor: s.chargeMinor } : {}),
      ...(refunded && s.refundMinor > 0 ? { refundedOnlineMinor: s.refundMinor } : {}),
      // Nothing more is owed after the stay is cancelled: a balance not yet taken never will be.
      ...(r.balanceChargedAt ? {} : { balanceChargeMinor: null, balanceChargeOn: null }),
    },
  });
  return { ...s, refunded, charged, ...(error ? { error } : {}) };
}
