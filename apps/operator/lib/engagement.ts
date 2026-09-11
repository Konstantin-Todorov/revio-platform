/**
 * Is a hotel actually using what it bought — and is it time to sell them the next thing?
 *
 * ## Why this is not one score
 *
 * The obvious design is an engagement number out of 100, and it is the wrong one. A single figure
 * mixing "they come in every day" with "eleven people use it" with "they touch every screen" cannot
 * be argued with, cannot be acted on, and moves for reasons nobody can name. `clientOpportunities`
 * already states the rule this file inherits: **null rather than a flattering guess**, and a number
 * on screen has to be one somebody could check.
 *
 * So there are three measures, they are reported separately, and each answers a different question
 * that leads to a different phone call:
 *
 *   REGULARITY  — how many days out of the window anybody came in at all.
 *                 *Is this part of their routine, or something they open when they remember?*
 *   REACH       — how many of their staff accounts were active.
 *                 ⚠️ The one most people never measure and the best churn predictor here: a product
 *                 used by ONE person leaves when that person leaves. Two hotels with identical view
 *                 counts are completely different businesses if one of them is a single manager.
 *   DEPTH       — how many distinct screens they opened.
 *                 *Are they running the hotel on it, or using it as a list?* A hotel that only ever
 *                 opens the dashboard has not adopted anything, however often they look at it.
 *
 * The verdict below is derived from rules with stated thresholds, in the same spirit as
 * `clientAttention`: severity means **how soon somebody should ring them**, not how bad they are.
 *
 * ## What this can never tell you, by construction
 *
 * Who did what, when, or for how long. Usage is a daily bucket per screen with identifiers stripped
 * from the path (`normaliseRoute` in `@revio/core`), so "was the housekeeping board used" is
 * answerable and "what did Maria do at 14:32" is not, and cannot become so without changing what is
 * stored. That is deliberate: this is a product measurement, not a staff-monitoring tool, and the
 * hotels whose staff it would be monitoring are our customers.
 */

export interface EngagementFacts {
  /** Distinct days in the window on which anybody from this hotel opened a screen. */
  activeDays: number;
  /** Length of the window in days — 30 everywhere today, passed in so the rules stay honest. */
  windowDays: number;
  /** Distinct people active in the window. */
  peopleActive: number;
  /** Staff accounts that exist and could be active. */
  staffAccounts: number;
  /** Distinct screens opened in the window. */
  screensUsed: number;
  /** Screens their products offer. The denominator for depth. */
  screensAvailable: number;
  viewsLast7d: number;
  viewsPrev7d: number;
  /** Days since anybody was last seen. `null` means never seen at all. */
  lastSeenDaysAgo: number | null;
  /** How long they have been a customer. Nothing is expected of a hotel in its first fortnight. */
  tenureDays: number;
  /** Products they do not own yet. Empty means there is nothing to sell them. */
  unownedProducts: readonly string[];
}

export type EngagementVerdict =
  /** In every day, several people, most of the product. */
  | "thriving"
  /** A normal working rhythm. The majority of healthy customers live here. */
  | "steady"
  /** Was a habit, is becoming one less. The only verdict with a deadline on it. */
  | "slipping"
  /** Nothing for a fortnight or more. */
  | "quiet"
  /** Bought it and never opened it. */
  | "never_started"
  /** Too new to say anything about, and saying something anyway would be noise. */
  | "too_new";

export interface Measure {
  label: string;
  value: number;
  outOf: number;
  /** What the reader should take from it, in one clause. */
  note: string;
}

export interface Engagement {
  verdict: EngagementVerdict;
  /** Three or four words, for a pill. */
  headline: string;
  /** One sentence that says what to do, or explicitly that there is nothing to do. */
  detail: string;
  regularity: Measure;
  reach: Measure;
  depth: Measure;
  /** Week-on-week change in views, as a percentage. `null` when last week had nothing to compare to. */
  trendPct: number | null;
  /**
   * Worth a conversation about the next product — with the reasons, so the call opens with evidence
   * rather than with a quota. Empty when it is not time.
   */
  upsellReasons: string[];
}

/** Nothing is expected of a hotel in its first fortnight; every rule below waits for this. */
const GRACE_DAYS = 14;
/** A habit, not a visit: in on more than half the days in the window. */
const REGULAR_PCT = 50;
/** More than one person. The line between a product the hotel uses and one a person uses. */
const SHARED_MIN_PEOPLE = 2;
/** Two weeks of silence is not a quiet patch, it is a customer who has stopped. */
const QUIET_DAYS = 14;
/** Long enough to have formed an opinion worth selling into. */
const UPSELL_MIN_TENURE_DAYS = 60;

const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100));

export function engagementOf(f: EngagementFacts): Engagement {
  const regularityPct = pct(f.activeDays, f.windowDays);
  const depthPct = pct(f.screensUsed, f.screensAvailable);

  const regularity: Measure = {
    label: "Regularity",
    value: f.activeDays,
    outOf: f.windowDays,
    note:
      regularityPct >= REGULAR_PCT
        ? "part of the working day"
        : regularityPct > 0
          ? "opened now and then, not daily"
          : "not opened at all",
  };
  const reach: Measure = {
    label: "People",
    value: f.peopleActive,
    outOf: f.staffAccounts,
    /*
     * ⚠️ The note changes meaning at 1, not at some percentage. "One of four staff" and "one of
     * twelve" are the same risk: the product lives in one person's habits, and it leaves with them.
     */
    note:
      f.peopleActive === 0
        ? "nobody has been in"
        : f.peopleActive === 1
          ? "one person only — it leaves if they do"
          : `${f.peopleActive} of their team`,
  };
  const depth: Measure = {
    label: "Screens used",
    value: f.screensUsed,
    outOf: f.screensAvailable,
    note:
      depthPct >= 50
        ? "running the hotel on it"
        : depthPct > 0
          ? "a corner of what they bought"
          : "none",
  };

  /*
   * `null`, not 0, when the previous week had no views. A hotel going from nothing to something is
   * not "+100%" and is not "no change" — there is genuinely no percentage to report, and inventing
   * one is how a first week of use gets read as explosive growth.
   */
  const trendPct =
    f.viewsPrev7d > 0 ? Math.round(((f.viewsLast7d - f.viewsPrev7d) / f.viewsPrev7d) * 100) : null;

  const verdict = verdictFor(f, regularityPct);
  const { headline, detail } = wordsFor(verdict, f, trendPct);

  return {
    verdict,
    headline,
    detail,
    regularity,
    reach,
    depth,
    trendPct,
    upsellReasons: upsellReasonsFor(f, verdict, regularityPct, depthPct),
  };
}

function verdictFor(f: EngagementFacts, regularityPct: number): EngagementVerdict {
  // Nothing is expected yet, and a flag raised inside the grace period is noise that teaches people
  // to ignore this column. Same rule as `clientAttention`.
  if (f.tenureDays < GRACE_DAYS) return "too_new";
  if (f.lastSeenDaysAgo === null) return "never_started";
  if (f.lastSeenDaysAgo >= QUIET_DAYS) return "quiet";

  /*
   * Slipping is checked BEFORE thriving and steady, because it is the only verdict with a deadline.
   * A hotel halfway down from a strong month still looks healthy on totals — that is exactly the
   * one worth a call, and it is the one a totals-based screen always misses.
   */
  if (f.viewsPrev7d > 0 && f.viewsLast7d * 2 <= f.viewsPrev7d) return "slipping";

  if (regularityPct >= REGULAR_PCT && f.peopleActive >= SHARED_MIN_PEOPLE) return "thriving";
  return "steady";
}

function wordsFor(
  verdict: EngagementVerdict,
  f: EngagementFacts,
  trendPct: number | null,
): { headline: string; detail: string } {
  switch (verdict) {
    case "too_new":
      return {
        headline: "Too new to judge",
        detail: `${f.tenureDays} day${f.tenureDays === 1 ? "" : "s"} old. Nothing is expected yet — the first fortnight is setup.`,
      };
    case "never_started":
      return {
        headline: "Never opened",
        /*
         * The most expensive failure in this business and the most fixable: they are paying, nobody
         * has logged in, and until somebody rings them nobody at either company knows.
         */
        detail: "They are paying for something nobody has ever opened. One phone call fixes this, and only in the first month.",
      };
    case "quiet":
      return {
        headline: "Gone quiet",
        detail: `Nothing for ${f.lastSeenDaysAgo} days. This is what leaving looks like before anybody says so — ring them before the renewal does it for you.`,
      };
    case "slipping":
      return {
        headline: "Slipping",
        detail: `Use has more than halved on the week${trendPct !== null ? ` (${trendPct}%)` : ""}. Something changed at their end — a person left, a season ended, or something in here stopped working.`,
      };
    case "thriving":
      return {
        headline: "Thriving",
        detail: `In on ${f.activeDays} of the last ${f.windowDays} days, across ${f.peopleActive} people. Nothing to do except not break it.`,
      };
    default:
      return {
        headline: "Steady",
        detail: `A normal rhythm: ${f.activeDays} of ${f.windowDays} days, ${f.peopleActive} ${f.peopleActive === 1 ? "person" : "people"}.`,
      };
  }
}

/**
 * Is it time to talk about the next product — and what is the evidence?
 *
 * Reasons rather than a boolean, because a sales call that opens with *"you have been in every day
 * for two months and six of your staff use it"* is a different conversation from one that opens with
 * *"our system flagged you"*. Empty means it is not time, and an empty list must never be filled in
 * with something weak: a pitch to somebody who is not ready costs more than the pitch you skipped.
 */
function upsellReasonsFor(
  f: EngagementFacts,
  verdict: EngagementVerdict,
  regularityPct: number,
  depthPct: number,
): string[] {
  if (f.unownedProducts.length === 0) return [];
  // Only somebody who is actually using what they already bought. Selling a second product to a
  // hotel that has not opened the first is how you manufacture a refund.
  if (verdict !== "thriving" && verdict !== "steady") return [];
  if (f.tenureDays < UPSELL_MIN_TENURE_DAYS) return [];
  if (regularityPct < REGULAR_PCT) return [];

  const reasons = [
    `In on ${f.activeDays} of the last ${f.windowDays} days — it is part of how they work now.`,
  ];
  if (f.peopleActive >= SHARED_MIN_PEOPLE) {
    reasons.push(`${f.peopleActive} of their people use it, so it is the hotel's tool and not one person's.`);
  }
  if (depthPct >= 50) {
    reasons.push(`They use ${f.screensUsed} of the ${f.screensAvailable} screens available to them.`);
  }
  reasons.push(`${Math.floor(f.tenureDays / 30)} months in, and they do not yet have ${f.unownedProducts.join(" or ")}.`);
  return reasons;
}
