import {
  DEPOSIT_KINDS, FEE_KINDS, PAYMENT_RULES,
  type DepositKind, type FeeKind, type PaymentRule, type StayTermsPolicy,
} from "@revio/core";

/** The columns of a `CancellationPolicy` row that carry its terms. */
export interface PolicyTermsRow {
  payment: string;
  depositKind: string | null;
  depositValue: number | null;
  balanceDaysBefore: number | null;
  refundable: boolean;
  freeCancelDays: number;
  lateFee: string;
  lateFeePct: number | null;
  noShowFee: string;
  noShowFeePct: number | null;
}

/**
 * A stored policy → the terms `stayTerms` computes with. The columns are strings in the database;
 * an unknown value falls back to the SAFEST reading for the guest (a guarantee, a first-night fee)
 * rather than to a charge nobody configured.
 */
export function termsPolicyOf(row: PolicyTermsRow): StayTermsPolicy {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
  return {
    payment: pick<PaymentRule>(row.payment, PAYMENT_RULES, "guarantee"),
    depositKind: row.depositKind ? pick<DepositKind>(row.depositKind, DEPOSIT_KINDS, "first_night") : null,
    depositValue: row.depositValue,
    balanceDaysBefore: row.balanceDaysBefore,
    refundable: row.refundable,
    freeCancelDays: row.freeCancelDays,
    lateFee: pick<FeeKind>(row.lateFee, FEE_KINDS, "first_night"),
    lateFeePct: row.lateFeePct,
    noShowFee: pick<FeeKind>(row.noShowFee, FEE_KINDS, "first_night"),
    noShowFeePct: row.noShowFeePct,
  };
}

/**
 * The terms the engine may actually state. Cancellation is always the hotel's own rule; the payment
 * part collapses to "a card guarantees it, you pay at the hotel" whenever money cannot be taken —
 * online payments not configured on this deployment, or the hotel's Stripe account not accepting
 * charges. `canCharge` is the caller's single reading of both (the app's `paymentReady`).
 */
export function sellableTerms(policy: StayTermsPolicy, canCharge: boolean): StayTermsPolicy {
  return canCharge ? policy : { ...policy, payment: "guarantee", depositKind: null, depositValue: null, balanceDaysBefore: null };
}
