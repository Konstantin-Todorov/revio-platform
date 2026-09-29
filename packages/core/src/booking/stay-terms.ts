/**
 * What a guest pays, when, and what cancelling costs — computed from the rate's terms.
 *
 * Every serious booking engine keys this to the RATE (Lighthouse, Little Hotelier, Apaleo; Mews by
 * rate group): a flexible rate holds a card and charges nothing, a partially refundable one takes a
 * deposit, a non-refundable one is paid in full at booking. Cloudbeds' single deposit for every
 * booking is the documented weakness this avoids.
 *
 * It is pure so the three places that state it — the price on the results page, the summary beside
 * the card form, and the confirmation — cannot disagree. A guest who is told "pay nothing now" on
 * one screen and charged on the next has been lied to, whatever the reason.
 *
 * Money is integer minor units; dates are the property's calendar dates (`YYYY-MM-DD`), and `today`
 * is the PROPERTY's today (`todayInTimeZone`) — never the server's.
 */
import { addDays } from "../stays/calendar.js";

/** How the room is secured at booking. */
export type PaymentRule = "guarantee" | "deposit" | "prepay";
/** How a deposit is sized. `fixed` is minor units; `percent` is 1–100. */
export type DepositKind = "percent" | "first_night" | "fixed";
/** What a late cancellation or a no-show costs. `percent` is of the stay total. */
export type FeeKind = "first_night" | "full" | "percent";

export const PAYMENT_RULES: readonly PaymentRule[] = ["guarantee", "deposit", "prepay"];
export const DEPOSIT_KINDS: readonly DepositKind[] = ["percent", "first_night", "fixed"];
export const FEE_KINDS: readonly FeeKind[] = ["first_night", "full", "percent"];

export interface StayTermsPolicy {
  payment: PaymentRule;
  depositKind?: DepositKind | null;
  depositValue?: number | null;
  /** Charge whatever is still owed N days before arrival. Null = the rest is paid at the hotel. */
  balanceDaysBefore?: number | null;
  /** False = non-refundable: cancelling at any time costs the whole stay. */
  refundable: boolean;
  /** Free cancellation until this many days before arrival (0 = until the arrival day itself). */
  freeCancelDays: number;
  lateFee: FeeKind;
  lateFeePct?: number | null;
  noShowFee: FeeKind;
  noShowFeePct?: number | null;
}

export interface StayTerms {
  rule: PaymentRule;
  /** Taken when the booking is made. */
  payNowMinor: number;
  /** Taken automatically later, from the card saved at booking. */
  scheduled: { amountMinor: number; on: string } | null;
  /** Settled at the hotel. */
  atHotelMinor: number;
  /**
   * Whether a card is asked for at all. True under every rule — to pay now, to charge later, or to
   * guarantee against a no-show — except where the page takes no card (request-to-book), which the
   * caller states with `withoutCard`.
   */
  cardNeeded: boolean;
  refundable: boolean;
  /** Last date cancelling is free. Null when the rate is non-refundable or that date has passed. */
  freeCancelUntil: string | null;
  /** What cancelling costs after the free period (or at any time, if non-refundable). */
  lateCancelFeeMinor: number;
  noShowFeeMinor: number;
}

export interface StayFacts {
  totalMinor: number;
  firstNightMinor: number;
  arrival: string;
  /** The property's today. */
  today: string;
}

function pct(totalMinor: number, p: number | null | undefined): number {
  const v = Math.min(100, Math.max(0, p ?? 0));
  return Math.round((totalMinor * v) / 100);
}

function fee(kind: FeeKind, p: number | null | undefined, f: StayFacts): number {
  if (kind === "full") return f.totalMinor;
  if (kind === "percent") return pct(f.totalMinor, p);
  return Math.min(f.firstNightMinor, f.totalMinor);
}

function depositOf(p: StayTermsPolicy, f: StayFacts): number {
  const kind = p.depositKind ?? "first_night";
  const raw =
    kind === "percent" ? pct(f.totalMinor, p.depositValue)
    : kind === "fixed" ? Math.max(0, p.depositValue ?? 0)
    : f.firstNightMinor;
  return Math.min(raw, f.totalMinor);
}

export function stayTerms(p: StayTermsPolicy, f: StayFacts): StayTerms {
  const total = Math.max(0, f.totalMinor);
  let payNow = p.payment === "prepay" ? total : p.payment === "deposit" ? depositOf(p, f) : 0;
  let rest = total - payNow;
  let scheduled: StayTerms["scheduled"] = null;

  if (rest > 0 && p.balanceDaysBefore != null) {
    const on = addDays(f.arrival, -Math.max(0, p.balanceDaysBefore));
    if (on <= f.today) {
      // Booked inside the window: the balance would be due today, so it is part of today's payment
      // rather than a "scheduled" charge minutes from now that the guest never saw coming.
      payNow += rest;
      rest = 0;
    } else {
      scheduled = { amountMinor: rest, on };
      rest = 0;
    }
  }

  const freeUntil = p.refundable ? addDays(f.arrival, -Math.max(0, p.freeCancelDays)) : null;
  const freeCancelUntil = freeUntil && freeUntil >= f.today ? freeUntil : null;

  return {
    rule: p.payment,
    payNowMinor: payNow,
    scheduled,
    atHotelMinor: rest,
    cardNeeded: true,
    refundable: p.refundable,
    freeCancelUntil,
    lateCancelFeeMinor: p.refundable ? fee(p.lateFee, p.lateFeePct, f) : total,
    noShowFeeMinor: fee(p.noShowFee, p.noShowFeePct, f),
  };
}

/** The same terms on a page that takes no card (request-to-book): nothing is guaranteed by one. */
export function withoutCard(t: StayTerms): StayTerms {
  return { ...t, cardNeeded: false };
}

/** Anything that is not a valid policy is refused with a reason the form can show. */
export type StayTermsProblem =
  | "deposit_value_missing" | "deposit_percent_range" | "late_fee_percent_range" | "no_show_percent_range"
  | "free_cancel_days_range" | "balance_days_range" | "prepay_with_balance";

export function stayTermsProblems(p: StayTermsPolicy): StayTermsProblem[] {
  const out: StayTermsProblem[] = [];
  const inPct = (v: number | null | undefined) => v != null && Number.isInteger(v) && v >= 1 && v <= 100;
  if (p.payment === "deposit") {
    const k = p.depositKind ?? "first_night";
    if (k !== "first_night" && (p.depositValue == null || p.depositValue <= 0)) out.push("deposit_value_missing");
    if (k === "percent" && p.depositValue != null && !inPct(p.depositValue)) out.push("deposit_percent_range");
  }
  if (p.payment === "prepay" && p.balanceDaysBefore != null) out.push("prepay_with_balance");
  if (p.lateFee === "percent" && !inPct(p.lateFeePct)) out.push("late_fee_percent_range");
  if (p.noShowFee === "percent" && !inPct(p.noShowFeePct)) out.push("no_show_percent_range");
  if (!Number.isInteger(p.freeCancelDays) || p.freeCancelDays < 0 || p.freeCancelDays > 365) out.push("free_cancel_days_range");
  if (p.balanceDaysBefore != null && (!Number.isInteger(p.balanceDaysBefore) || p.balanceDaysBefore < 0 || p.balanceDaysBefore > 365)) {
    out.push("balance_days_range");
  }
  return out;
}

/*
 * The sentences a guest reads. Kept here, beside the arithmetic, so a change to what is charged
 * cannot ship without a change to what is said.
 */
const WORDS = {
  en: {
    payNothing: "Pay nothing now",
    payNow: (a: string) => `Pay ${a} now`,
    payAll: (a: string) => `Pay ${a} now — the whole stay`,
    later: (a: string, d: string) => `${a} charged automatically on ${d}`,
    atHotel: (a: string) => `${a} paid at the hotel`,
    guarantee: "Your card only guarantees the booking",
    freeUntil: (d: string) => `Free cancellation until ${d}`,
    nonRefundable: "Non-refundable",
    lateFee: (a: string) => `After that, cancelling costs ${a}`,
    nonRefundableFee: (a: string) => `Cancelling or changing costs ${a}`,
    noShow: (a: string) => `If you do not arrive: ${a}`,
    feeFromNow: (a: string) => `Cancelling now costs ${a}`,
  },
  bg: {
    payNothing: "Без плащане сега",
    payNow: (a: string) => `Платете ${a} сега`,
    payAll: (a: string) => `Платете ${a} сега — целия престой`,
    later: (a: string, d: string) => `${a} се удържат автоматично на ${d}`,
    atHotel: (a: string) => `${a} се плащат в хотела`,
    guarantee: "Картата само гарантира резервацията",
    freeUntil: (d: string) => `Безплатно анулиране до ${d}`,
    nonRefundable: "Без възстановяване",
    lateFee: (a: string) => `След това анулирането струва ${a}`,
    nonRefundableFee: (a: string) => `Анулиране или промяна струва ${a}`,
    noShow: (a: string) => `При неявяване: ${a}`,
    feeFromNow: (a: string) => `Анулирането вече струва ${a}`,
  },
} as const;

export interface StayTermsWords {
  /** Two short facts for beside a price: how you pay, and whether you can cancel. */
  payment: string;
  cancellation: string;
  /** The full statement, in the order a guest needs it: today, later, at the hotel, then cancelling. */
  details: string[];
}

export function stayTermsWords(
  t: StayTerms,
  lang: "bg" | "en",
  money: (minor: number) => string,
  day: (iso: string) => string,
): StayTermsWords {
  const w = WORDS[lang];
  const total = t.payNowMinor + (t.scheduled?.amountMinor ?? 0) + t.atHotelMinor;
  const payment =
    t.payNowMinor === 0 ? w.payNothing
    : t.payNowMinor >= total ? w.payAll(money(t.payNowMinor))
    : w.payNow(money(t.payNowMinor));
  // A refundable rate booked after its free window is not "non-refundable" — it costs its fee, and
  // saying the stronger thing would be as wrong as saying the weaker.
  const cancellation = t.freeCancelUntil
    ? w.freeUntil(day(t.freeCancelUntil))
    : t.refundable ? w.feeFromNow(money(t.lateCancelFeeMinor)) : w.nonRefundable;

  const details: string[] = [payment];
  if (t.scheduled) details.push(w.later(money(t.scheduled.amountMinor), day(t.scheduled.on)));
  if (t.atHotelMinor > 0) details.push(w.atHotel(money(t.atHotelMinor)));
  if (t.payNowMinor === 0 && !t.scheduled && t.cardNeeded) details.push(w.guarantee);
  details.push(cancellation);
  if (t.lateCancelFeeMinor > 0 && (t.freeCancelUntil || !t.refundable)) {
    details.push(t.freeCancelUntil ? w.lateFee(money(t.lateCancelFeeMinor)) : w.nonRefundableFee(money(t.lateCancelFeeMinor)));
  }
  if (t.noShowFeeMinor > 0) details.push(w.noShow(money(t.noShowFeeMinor)));
  return { payment, cancellation, details };
}
