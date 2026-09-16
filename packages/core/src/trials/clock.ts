/**
 * When a trial actually starts, and why it is not when the account was created.
 *
 * ## The rule
 *
 * **Each product is free for 30 days from the first time it is opened. A product must be opened
 * within 30 days of signing up, or its trial is no longer self-serve.**
 *
 * ## What it replaces, and why that was unfair
 *
 * Signing up switched on all three products and started **three clocks at the same instant**. A
 * hotel that spent its first fortnight on RevioLink — which is the sensible way to start — opened
 * RevioCRS on day fifteen with fifteen days left, and RevioPMS on day twenty-two with eight. We
 * advertised three trials and delivered one, and the two nobody opened expired unused.
 *
 * That is worse than giving fewer products: it is the shape of an offer that reads generous and
 * turns out not to be, which is the kind of thing a hotel remembers.
 *
 * ## Why it is bounded, and not simply "30 days whenever you like"
 *
 * A clock that starts on first open with no outer limit never ends: open RevioPMS in a year and a
 * fresh month begins. So the OFFER expires even though the clock has not started — thirty days to
 * take it up, thirty days to use it. The worst case is sixty days from signup, which is a number we
 * can plan around, rather than an open invitation.
 *
 * ## The one honest sentence
 *
 * "Free for 30 days from the day you open it — and you have your first month to open them."
 */

/*
 * ⚠️ `TRIAL_DAYS` and `trialEndsAt` are IMPORTED, not redeclared.
 *
 * The first version of this file declared its own `TRIAL_DAYS = 30` beside the one that already
 * existed in `trials.ts` — two constants, one meaning, and the day somebody changes the length they
 * will change one of them. TypeScript caught it as an ambiguous re-export, which is luck rather than
 * a system; the point stands either way.
 */
import { trialEndsAt } from "./trials.js";

/** How long after signing up a product may still be opened on the trial. */
export const TRIAL_CLAIM_DAYS = 30;

const DAY_MS = 86_400_000;

export interface TrialClockFacts {
  /** When the account became a customer — the claim window runs from here. */
  accountCreatedAt: Date;
  /** The first time this product was opened, or null if it never has been. */
  openedAt: Date | null;
}

export type TrialClock =
  /** Never opened, and still claimable. The banner invites rather than counts down. */
  | { state: "unopened"; claimDaysLeft: number }
  /** Never opened and the claim window has closed. Not self-serve any more. */
  | { state: "lapsed" }
  /** Running. `endsAt` is what every screen and every reminder must agree on. */
  | { state: "running"; startedAt: Date; endsAt: Date; daysLeft: number }
  | { state: "ended"; startedAt: Date; endsAt: Date };

/**
 * Whole days remaining, rounded UP: a trial with an hour left has one day left, not zero.
 *
 * ⚠️ The `+ 0` is not noise. `Math.ceil` of a small negative — an hour into the past — returns
 * JavaScript's **negative zero**, which prints as "-0". A banner reading "-0 days left" is the kind
 * of detail that tells a hotel nobody checked the software they are being asked to run their
 * bookings on. Adding zero collapses it to 0.
 */
export function daysUntil(when: Date, now: Date): number {
  return Math.ceil((when.getTime() - now.getTime()) / DAY_MS) + 0;
}

/** What `endsAt` becomes the moment a product is first opened. One definition, shared. */
export function trialEndFor(openedAt: Date): Date {
  return trialEndsAt(openedAt);
}

/**
 * Where this product's trial stands.
 *
 * ⚠️ `endsAt` is DERIVED from `openedAt` here, and the stored column must be written to match. Two
 * places computing the end of a trial is how a banner and a reminder email come to disagree about
 * the date — and the one the hotel believes is whichever they read last.
 */
export function trialClock(f: TrialClockFacts, now: Date = new Date()): TrialClock {
  if (f.openedAt === null) {
    const claimDaysLeft = daysUntil(new Date(f.accountCreatedAt.getTime() + TRIAL_CLAIM_DAYS * DAY_MS), now);
    return claimDaysLeft > 0 ? { state: "unopened", claimDaysLeft } : { state: "lapsed" };
  }
  const endsAt = trialEndFor(f.openedAt);
  const daysLeft = daysUntil(endsAt, now);
  return daysLeft > 0
    ? { state: "running", startedAt: f.openedAt, endsAt, daysLeft }
    : { state: "ended", startedAt: f.openedAt, endsAt };
}

/**
 * May this product still be opened on the trial?
 *
 * Separate from `trialClock` because it answers a question asked BEFORE the product is opened —
 * the door, not the countdown.
 */
export function canStillClaim(f: TrialClockFacts, now: Date = new Date()): boolean {
  return f.openedAt === null && trialClock(f, now).state === "unopened";
}
