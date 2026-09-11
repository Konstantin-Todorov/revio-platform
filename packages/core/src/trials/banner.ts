import { PRODUCT_BY_KEY, type ProductKey } from "../products/products.js";
import { TRIAL_REMINDER_DAYS } from "./trials.js";

/**
 * What a hotel is told, inside their own product, while a trial is running.
 *
 * ## Why this exists at all
 *
 * Until now a trial was invisible from the hotel's side. The product simply appeared, worked for a
 * month, and then one day stopped — with two emails as the only warning, sent to whichever address
 * happened to be on the owner account. The founder asked the obvious question on 2026-09-11:
 * *"shouldn't it show somewhere, e.g. at the top, that they're on a free trial and how much time is
 * left, and if they want to make a plan?"*
 *
 * It should, and there is a harder reason than politeness. **Access that ends without warning looks
 * like a fault, not a decision.** A receptionist who opens RevioPMS to a locked screen rings us to
 * report that it is broken; nobody at that hotel ever made a choice about keeping it. A running
 * count in the corner of the product turns an expiry into something they saw coming.
 *
 * ## Two things this must never do
 *
 * **It must never nag.** It is one strip at the top of the page, it states a fact, and once they
 * have asked to keep it, it stops asking — `keepRequested` turns the invitation into an
 * acknowledgement. A banner that keeps selling after the customer has said yes is the fastest way
 * to make somebody stop reading banners.
 *
 * **It must never imply a charge is coming.** The platform promise is that nothing becomes a bill on
 * its own, so the words are "it switches off", never "your subscription begins". The day this copy
 * starts hinting at automatic billing, the promise is broken in the only place the customer reads.
 */

/** How loud the strip is. Urgency is about how soon, not how bad — the same rule the operator uses. */
export type TrialBannerTone = "calm" | "warning" | "urgent";

export interface TrialBannerFacts {
  product: ProductKey;
  startedAt: Date;
  endsAt: Date;
  /** They have already pressed "Keep it". The banner acknowledges instead of asking. */
  keepRequested: boolean;
}

export interface TrialBanner {
  productName: string;
  tone: TrialBannerTone;
  /** Read first and alone: what this is and how long is left. */
  headline: string;
  /** The sentence that makes it safe to ignore. */
  detail: string;
  daysLeft: number;
  /** 0–1 of the trial used up, for the progress rule. Clamped, so a clock skew cannot draw past the end. */
  elapsed: number;
  /** The invitation, or `null` once they have taken it. */
  cta: string | null;
}

/** Whole days remaining, rounded UP: a trial with four hours left has "1 day", never "0". */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
}

/**
 * The banner, or `null` when there is nothing to say.
 *
 * `null` rather than an empty banner is the point: a hotel that owns the product outright must see
 * no strip at all, and the caller decides that by simply not having a trial to pass in.
 */
export function trialBanner(f: TrialBannerFacts, now: Date, formatDate: (d: Date) => string): TrialBanner {
  const name = PRODUCT_BY_KEY[f.product]?.name ?? f.product;
  const daysLeft = trialDaysLeft(f.endsAt, now);
  const ends = formatDate(f.endsAt);

  const total = Math.max(1, f.endsAt.getTime() - f.startedAt.getTime());
  const used = now.getTime() - f.startedAt.getTime();
  const elapsed = Math.min(1, Math.max(0, used / total));

  /*
   * The thresholds are the SAME days the reminder emails use. If the strip turned amber on a
   * different day from the email, a hotel would get two different accounts of how urgent this is —
   * and the one they trust is whichever arrived last.
   */
  const [warnAt, urgentAt] = TRIAL_REMINDER_DAYS;
  const tone: TrialBannerTone = daysLeft <= urgentAt ? "urgent" : daysLeft <= warnAt ? "warning" : "calm";

  const headline =
    daysLeft === 0
      ? `Your ${name} trial ends today`
      : daysLeft === 1
        ? `Last day of your ${name} trial`
        : `${daysLeft} days left of your free ${name} trial`;

  /*
   * Two facts, in this order: what happens if they do nothing, then that nothing is lost. Fear of
   * losing data is what stops people trying software, and it is the fear that is least true here —
   * the rooms, rates and guests are shared with the products they already pay for.
   */
  const detail = f.keepRequested
    ? `You have asked to keep ${name}. We will be in touch to sort it out before ${ends} — nothing stops in the meantime.`
    : `Nothing is charged and nothing renews on its own. If you do nothing, ${name} simply switches off on ${ends} and none of your data is deleted.`;

  return {
    productName: name,
    tone,
    headline,
    detail,
    daysLeft,
    elapsed,
    cta: f.keepRequested ? null : `Keep ${name}`,
  };
}
