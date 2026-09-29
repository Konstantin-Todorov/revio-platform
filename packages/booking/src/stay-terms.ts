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
 * Whether RevioDirect can take money online yet. Until the card step charges (Stripe Payment Element
 * on the hotel's own account — BUILD-PLAN "RevioDirect takes real payments"), a policy that says
 * "deposit" or "pay in full" must not be PRINTED as one: the page would say "pay €90 now" and then
 * take nothing, which is a promise broken at the one moment a guest is reading every word.
 */
export const ONLINE_PAYMENTS_LIVE = false;

/**
 * The terms the engine may actually state. Cancellation is always the hotel's own rule; the payment
 * part collapses to "a card guarantees it, you pay at the hotel" whenever money cannot be taken —
 * online payments not live yet, or the hotel's Stripe account not accepting charges.
 */
export function sellableTerms(policy: StayTermsPolicy, canCharge: boolean): StayTermsPolicy {
  return canCharge && ONLINE_PAYMENTS_LIVE ? policy : { ...policy, payment: "guarantee", depositKind: null, depositValue: null, balanceDaysBefore: null };
}
