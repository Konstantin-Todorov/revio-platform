import type { ProductKey } from "../products/products.js";

/**
 * Trying a product before buying it.
 *
 * ## Why our trial is genuinely different, and the copy should say so
 *
 * A normal SaaS trial asks you to import your data first, so most of the fortnight is spent setting
 * up and the evaluation never really happens. Ours cannot have that problem: the hotel's rooms,
 * rates and guests are **already in the system**, because every Revio product shares one core. A
 * trial is an entitlement flag; there is nothing to import and nothing to configure.
 *
 * That is the argument, and it is true rather than a slogan — which is why it is worth saying.
 *
 * ## What must never happen
 *
 * **A trial must never become a charge on its own.** It expires and access stops; converting is a
 * separate, deliberate act by an operator. A customer who discovers a subscription they did not
 * agree to will not stay one, and "we told you in an email" is not consent.
 *
 * ## What ending a trial does NOT do
 *
 * It takes nothing away except access. Rooms, rates, reservations and guests are shared with the
 * products they already pay for, so nothing is deleted, nothing is exported, and switching it back
 * on restores everything instantly. The expiry email says exactly that, because a hotel that fears
 * losing data will not start a trial at all.
 */

/** Long enough to live through a full booking cycle, short enough to be a decision. */
export const TRIAL_DAYS = 30;

/** When to warn, most urgent last. Each fires once — see `dueReminder`. */
export const TRIAL_REMINDER_DAYS = [7, 1] as const;
export type TrialReminderDay = (typeof TRIAL_REMINDER_DAYS)[number];

export interface TrialFacts {
  product: ProductKey;
  endsAt: Date;
  /** Set once it has stopped, whichever way. A trial with this set is history. */
  endedAt: Date | null;
  /** Which reminders have already gone out, so none is ever sent twice. */
  remindedDays: readonly number[];
}

export type TrialState = "active" | "ending-soon" | "expired" | "ended";

/**
 * Where a trial stands.
 *
 * `ended` and `expired` are deliberately different. `ended` means somebody closed it — converted or
 * cancelled — and it is history. `expired` means the clock ran out and **nothing has acted on it
 * yet**: access is still on and the sweep has work to do. Collapsing the two would hide exactly the
 * state that needs a job to run.
 */
export function trialState(trial: TrialFacts, now: Date): TrialState {
  if (trial.endedAt) return "ended";
  if (now >= trial.endsAt) return "expired";
  return daysRemaining(trial, now) <= TRIAL_REMINDER_DAYS[0] ? "ending-soon" : "active";
}

/**
 * Whole days left, rounded UP.
 *
 * A trial with four hours to run has "1 day left", not "0". Telling somebody they have no days left
 * while they still have access is the kind of small wrongness that makes people distrust every other
 * number on the screen.
 */
export function daysRemaining(trial: TrialFacts, now: Date): number {
  const ms = trial.endsAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Which reminder is due right now, or `null`.
 *
 * Returns the **most urgent** unsent one whose threshold has been reached, so a sweep that has not
 * run for a week does not send the 7-day warning after the 1-day warning would have been truer. It
 * never returns a reminder already in `remindedDays`, which is what makes running the job twice
 * harmless.
 */
export function dueReminder(trial: TrialFacts, now: Date): TrialReminderDay | null {
  if (trial.endedAt || now >= trial.endsAt) return null;
  const left = daysRemaining(trial, now);
  // Ascending, so the most urgent threshold is considered first.
  for (const day of [...TRIAL_REMINDER_DAYS].sort((a, b) => a - b)) {
    if (left <= day && !trial.remindedDays.includes(day)) return day;
  }
  return null;
}

/** Has the clock run out with nothing having acted on it? The sweep's only question. */
export function needsExpiring(trial: TrialFacts, now: Date): boolean {
  return !trial.endedAt && now >= trial.endsAt;
}

/** The end date for a trial started now. */
export function trialEndsAt(startedAt: Date, days = TRIAL_DAYS): Date {
  return new Date(startedAt.getTime() + Math.max(1, Math.round(days)) * 86_400_000);
}

/** How a trial finished. `expired` is the only one a machine may write. */
export type TrialOutcome = "converted" | "cancelled" | "expired";

export function trialOutcomeLabel(outcome: string | null): string {
  switch (outcome) {
    case "converted": return "Kept it";
    case "cancelled": return "Stopped early";
    case "expired": return "Ran out";
    default: return "Running";
  }
}
