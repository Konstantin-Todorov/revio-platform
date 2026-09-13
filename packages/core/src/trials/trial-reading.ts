import { PRODUCT_BY_KEY, type ProductInfo, type ProductKey } from "../products/products.js";
import { TRIAL_DAYS } from "./trials.js";

/**
 * What a trial is actually doing, while there is still time to do something about it.
 *
 * ## Why engagement's answer is the wrong answer here
 *
 * `engagementOf` judges a customer over a rolling thirty days and calls two silent weeks "quiet".
 * For a customer that is fair. For a **trial** it is useless: a trial has a deadline, so silence at
 * day 14 of 30 is not a slow drift, it is most of the remaining chance gone. The same number of
 * quiet days means something different depending on how much of the clock is left, and this reads
 * it that way.
 *
 * ## ⚠️ The strongest product is the one to sell — not the one they said at signup
 *
 * Every hotel gets all three. That decision only pays off if we then look at what they USED. A
 * hotel that signed up "for the channel manager" and spent three weeks in the front desk is a PMS
 * sale, and their own usage is the argument for it — a far better one than the box they ticked on
 * day zero before seeing anything.
 *
 * ## ⚠️ And a trial nobody opened is not a sales call
 *
 * Reading "sell them RevioPMS" off a trial with four page views would be inventing a signal out of
 * noise. A trial that never started needs a different conversation — what went wrong, was the setup
 * too hard, did the confirmation email even arrive — and this refuses to dress that up as an
 * opportunity.
 */

export interface TrialProductUsage {
  product: ProductKey;
  /** Distinct days anybody opened a screen in this product during the trial. */
  activeDays: number;
  views: number;
  /** Distinct people who opened it. Depth: one owner poking about is not a hotel adopting it. */
  people: number;
}

export interface TrialReadingFacts {
  startedAt: Date;
  endsAt: Date;
  /** Set once the trial finished, whichever way. */
  endedAt: Date | null;
  /** expired | cancelled | converted — only `expired` is ever written by a machine. */
  outcome: string | null;
  keepRequestedAt: Date | null;
  usage: TrialProductUsage[];
  /** Days since anybody from this hotel opened anything. `null` means never. */
  lastSeenDaysAgo: number | null;
  now: Date;
}

export type TrialVerdict =
  /** Bought nothing, opened nothing. A rescue, not a sale. */
  | "never_opened"
  /** Early days and they are moving about. Nothing to do yet. */
  | "exploring"
  /** Real, repeated use. This is the one to ask for the order. */
  | "landing"
  /** It started and stopped. The only verdict with a deadline attached. */
  | "drifting"
  /** They asked to keep it. Stop analysing and reply. */
  | "asked_to_keep"
  /** Finished, and they had used it properly. Still worth a call. */
  | "ended_engaged"
  /** Finished having barely been opened. */
  | "ended_cold"
  /** Became a customer. */
  | "converted";

export interface TrialReading {
  verdict: TrialVerdict;
  /**
   * Whether the trial is over.
   *
   * ⚠️ NOT the same as `daysLeft <= 0`. A trial can be ended early — converted, or cancelled by us —
   * while its `endsAt` is still weeks away, and reading the countdown alone produced a row saying
   * "ended · was used" beside "11 days left" on the same line. Found by looking at the rendered
   * screen; every test passed.
   */
  finished: boolean;
  /** Negative once it has finished. */
  daysLeft: number;
  daysElapsed: number;
  /** 0–1 through the trial period. */
  progress: number;
  /** Total distinct active days across every product. */
  activeDays: number;
  /** The product they actually used most — what to lead a conversation with. `null` when unused. */
  strongest: ProductInfo | null;
  /** Products they never opened at all. Not a failure — often just not their job. */
  untouched: ProductInfo[];
  /** One sentence citing THEIR numbers, never ours. */
  headline: string;
  /** What to do, or null when the honest answer is "nothing yet". */
  action: string | null;
  /** How soon — `now` means today, before the clock runs out. */
  urgency: "now" | "soon" | "none";
}

const DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}

export function readTrial(f: TrialReadingFacts): TrialReading {
  const daysElapsed = Math.max(0, daysBetween(f.startedAt, f.now));
  const daysLeft = daysBetween(f.now, f.endsAt);
  const total = Math.max(1, daysBetween(f.startedAt, f.endsAt) || TRIAL_DAYS);
  const progress = Math.min(1, Math.max(0, daysElapsed / total));

  const used = [...f.usage].filter((u) => u.views > 0).sort((a, b) => b.activeDays - a.activeDays || b.views - a.views);
  const strongest = used[0] ? PRODUCT_BY_KEY[used[0].product]! : null;
  const activeDays = Math.max(0, ...f.usage.map((u) => u.activeDays), 0);
  const touched = new Set(used.map((u) => u.product));
  const untouched = (["cm", "crs", "pms"] as ProductKey[]).filter((k) => !touched.has(k)).map((k) => PRODUCT_BY_KEY[k]!);
  const people = Math.max(0, ...f.usage.map((u) => u.people), 0);

  const name = (p: ProductInfo | null) => p?.name ?? "the products";

  // ── Finished ────────────────────────────────────────────────────────────────
  if (f.endedAt || f.outcome) {
    if (f.outcome === "converted") {
      return base("converted", "They bought it.", null, "none");
    }
    if (activeDays >= 5) {
      return base(
        "ended_engaged",
        `Used ${name(strongest)} on ${activeDays} separate days and then the trial ran out.`,
        `Call them. They know what ${name(strongest)} does and stopped only because the clock did.`,
        "now",
      );
    }
    return base(
      "ended_cold",
      activeDays === 0 ? "The trial finished without a single screen being opened." : `Opened on only ${activeDays} day${activeDays === 1 ? "" : "s"} before it ran out.`,
      "Ask what got in the way — this is a setup or onboarding question, not a price one.",
      "none",
    );
  }

  // ── Running ─────────────────────────────────────────────────────────────────
  if (f.keepRequestedAt) {
    return base(
      "asked_to_keep",
      `They have asked to keep ${name(strongest)}.`,
      "Reply. This is the strongest signal we get and it has a person waiting on the other end.",
      "now",
    );
  }

  if (activeDays === 0) {
    /*
     * Nothing at all. Early on that is ordinary — somebody signed up on a Friday. Past the halfway
     * mark it is the trial failing quietly, and the question is whether they ever got in.
     */
    return base(
      "never_opened",
      daysElapsed <= 2 ? "Signed up, not opened yet." : `${daysElapsed} days in and nothing has been opened.`,
      daysElapsed <= 2
        ? null
        : "Check they received the confirmation email and got through setup. This is a rescue, not a sale.",
      daysElapsed <= 2 ? "none" : progress >= 0.5 ? "now" : "soon",
    );
  }

  // Started and stopped. The one reading that is worth acting on TODAY rather than at expiry.
  const stalled = f.lastSeenDaysAgo !== null && f.lastSeenDaysAgo >= 5;
  if (stalled) {
    return base(
      "drifting",
      `Used ${name(strongest)} on ${activeDays} day${activeDays === 1 ? "" : "s"}, then nothing for ${f.lastSeenDaysAgo}.`,
      daysLeft > 0
        ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left — ask what they got stuck on while it can still be fixed.`
        : "The clock has run out; ask what stopped them.",
      daysLeft <= 7 ? "now" : "soon",
    );
  }

  if (activeDays >= 5 && people >= 2) {
    return base(
      "landing",
      `${people} people used ${name(strongest)} on ${activeDays} separate days.`,
      daysLeft <= 10
        ? `Ask for the order. ${daysLeft} day${daysLeft === 1 ? "" : "s"} left, and their own usage is the argument.`
        : "Nothing yet — let it run, then lead with their own numbers.",
      daysLeft <= 10 ? "now" : "none",
    );
  }

  return base(
    "exploring",
    `${activeDays} active day${activeDays === 1 ? "" : "s"} so far, mostly in ${name(strongest)}.`,
    daysLeft <= 7 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left — worth a check-in before it lapses.` : null,
    daysLeft <= 7 ? "soon" : "none",
  );

  function base(verdict: TrialVerdict, headline: string, action: string | null, urgency: TrialReading["urgency"]): TrialReading {
    const finished = Boolean(f.endedAt || f.outcome) || daysLeft < 0;
    return { verdict, finished, daysLeft, daysElapsed, progress, activeDays, strongest, untouched, headline, action, urgency };
  }
}

/** Trials worth a human's attention first — most urgent, then closest to running out. */
export function trialsByUrgency<T extends { reading: TrialReading }>(rows: T[]): T[] {
  const rank: Record<TrialReading["urgency"], number> = { now: 0, soon: 1, none: 2 };
  return [...rows].sort(
    (a, b) => rank[a.reading.urgency] - rank[b.reading.urgency] || a.reading.daysLeft - b.reading.daysLeft,
  );
}
