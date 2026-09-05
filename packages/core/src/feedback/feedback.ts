/**
 * ⚠️ DORMANT — the feature is ON HOLD as of 2026-09-05. Nothing calls this.
 *
 * **Do not wire it up without reading `docs/specs/REVIEW-REQUESTS.md` first**, where the decision and
 * its reasoning live. The short version: asking a guest acquired through an OTA to review the hotel
 * sits inside that OTA's contract — Booking.com, Trip.com, Expedia and others each restrict
 * contacting and marketing to guests they introduced — and the contractual surface was judged not
 * worth the feature.
 *
 * It is kept rather than deleted because the reasoning below is the valuable part, the code is inert
 * (pure functions, no callers, no side effects), and the likely return is a narrower version
 * restricted to **direct** bookings only. Production data supports that: OTA reservations carry no
 * guest email at all, so this could only ever have reached direct bookers anyway.
 *
 * ---
 *
 * Guest feedback — who we ask, and what their answer changes.
 *
 * Pure and here because the two judgements in it are the ones a hotelier will argue with: **who we
 * decline to ask**, and **what a low rating does**. Both belong in one tested place rather than
 * inside a job and a route that can drift apart.
 *
 * ## The rule this module exists to make impossible to break
 *
 * Competing tools ask everyone, then show the public review links **only to the guests who rated
 * well**, routing the unhappy ones to a private form. That is review gating. Google's policies
 * prohibit soliciting reviews selectively, regulators treat sentiment-filtered solicitation as a
 * deceptive practice, and the risk lands on the hotel rather than on us. It is also bad for them: a
 * score that has been engineered teaches the hotel nothing.
 *
 * So `routeFeedback` returns the public prompt as **always shown**, for every rating, and the tests
 * assert it across all five. The rating decides who is *told internally* and *how fast* — it never
 * decides who is invited to review publicly. Anyone introducing gating has to delete a passing test
 * that says why, rather than quietly adding a condition.
 */

/** 1–5. Anything else is not a rating, and is refused rather than clamped. */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

/** How fast a human needs to see this. */
export type FeedbackUrgency = "alert" | "digest" | "logged";

export interface FeedbackRouting {
  urgency: FeedbackUrgency;
  /**
   * Whether the guest is shown the public review links.
   *
   * **Always true.** It is a field rather than an omission so that the decision is visible at every
   * call site and provable in a test — see the module docstring.
   */
  showPublicLinks: true;
}

/**
 * What happens when a guest rates their stay.
 *
 * 1–2 is somebody who had a bad time and has just told us within days of leaving; that is worth
 * interrupting a person for. 3 is the rating that most often carries the useful sentence, but it is
 * not an emergency. 4–5 is counted.
 */
export function routeFeedback(rating: number): FeedbackRouting {
  if (!isValidRating(rating)) {
    throw new Error(`Not a rating: ${rating}. Ratings are integers 1–5.`);
  }
  const urgency: FeedbackUrgency = rating <= 2 ? "alert" : rating === 3 ? "digest" : "logged";
  return { urgency, showPublicLinks: true };
}

/** Why we are not asking this guest. `null` from `canAskForFeedback` means we are. */
export type FeedbackRefusal =
  | "no-email"
  | "stay-did-not-happen"
  | "opted-out"
  | "unpaid-balance"
  | "not-departed"
  | "too-soon"
  | "asked-recently";

/**
 * Refusals that will never become "yes" for this stay, however long we wait.
 *
 * The distinction is operational, not cosmetic: a sweep can stop reconsidering a permanently refused
 * stay instead of re-evaluating it every night for the rest of the year. It also stops a hotel being
 * told "we will ask them later" about a guest we are never going to ask.
 */
const PERMANENT: ReadonlySet<FeedbackRefusal> = new Set<FeedbackRefusal>([
  "no-email",
  "stay-did-not-happen",
  "opted-out",
]);

export function isPermanentRefusal(refusal: FeedbackRefusal): boolean {
  return PERMANENT.has(refusal);
}

export interface FeedbackAskFacts {
  guestEmail: string | null;
  /** The CRS commercial status. A stay that did not happen has nothing to review. */
  reservationStatus: string;
  /** Authoritative end of the stay. Null means they have not left. */
  departedAt: Date | null;
  /** Folio balance in minor units. Positive means the guest still owes. */
  balanceMinor: number;
  /** K6's flag. It means "leave me alone", and this is the same spirit. */
  recognitionOptOut: boolean;
  /** When this GUEST was last asked, across any stay — not when this reservation was asked. */
  lastAskedAt: Date | null;
}

export interface FeedbackAskConfig {
  /** Days after departure before we ask. */
  askAfterDays: number;
  /** Never ask the same guest more often than this. A monthly regular must not be asked monthly. */
  askAtMostEveryMonths: number;
}

export const DEFAULT_ASK_AFTER_DAYS = 1;
export const DEFAULT_ASK_AT_MOST_EVERY_MONTHS = 6;

/** Statuses where there was no stay to have an opinion about. */
const NO_STAY_HAPPENED = new Set(["cancelled", "no_show"]);

/**
 * May we ask this guest for feedback? `null` means yes.
 *
 * Ordered so the answer is the most fundamental reason, not merely the first one checked: a guest
 * who opted out is reported as opted out even if they also happen to owe money, because that is the
 * reason that will still be true next week and the one a person needs to see.
 *
 * ⚠️ Asking the wrong guest is worse than not asking. Every refusal here was chosen with that in
 * mind — particularly the unpaid balance: chasing the money and the review in the same week reads as
 * tone-deaf to the guest and puts the hotel's score at risk for the sake of a reminder.
 */
export function canAskForFeedback(
  facts: FeedbackAskFacts,
  config: FeedbackAskConfig,
  now: Date,
): FeedbackRefusal | null {
  if (!facts.guestEmail?.trim()) return "no-email";
  if (NO_STAY_HAPPENED.has(facts.reservationStatus)) return "stay-did-not-happen";
  if (facts.recognitionOptOut) return "opted-out";

  // Positive means owed. A credit balance is the hotel's problem, not a reason to stay quiet.
  if (Number.isFinite(facts.balanceMinor) && facts.balanceMinor > 0) return "unpaid-balance";

  if (facts.departedAt == null) return "not-departed";
  if (now < askDueAt(facts.departedAt, config.askAfterDays)) return "too-soon";

  if (facts.lastAskedAt != null) {
    const allowedFrom = addMonths(facts.lastAskedAt, config.askAtMostEveryMonths);
    if (now < allowedFrom) return "asked-recently";
  }

  return null;
}

/** The earliest moment we would ask about a stay that ended at `departedAt`. */
export function askDueAt(departedAt: Date, askAfterDays: number): Date {
  const days = Math.max(0, Math.round(askAfterDays));
  return new Date(departedAt.getTime() + days * 86_400_000);
}

/**
 * Add whole months, clamping rather than overflowing.
 *
 * 31 January plus one month is 28 February, not 3 March. The naive `setMonth` rolls into the next
 * month, which here would mean asking a guest days EARLIER than the hotel's configured minimum —
 * a quiet violation of the one setting that exists to stop us pestering a regular.
 */
export function addMonths(from: Date, months: number): Date {
  const n = Math.max(0, Math.round(months));
  const d = new Date(from.getTime());
  const targetMonth = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  // Last day of the target month, then take whichever is earlier.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * The hotel's own average, and the number they will quote back at us.
 *
 * `null` rather than 0 when nobody has answered: "no ratings yet" and "everyone rated zero" are
 * different facts, and a 0.0 on a dashboard reads as the second. Same refusal `channelEconomics`
 * and the waitlist metrics already make.
 */
export function averageRating(ratings: readonly number[]): number | null {
  const valid = ratings.filter(isValidRating);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export interface FeedbackSummary {
  asked: number;
  answered: number;
  /** answered ÷ asked, or `null` when nobody has been asked. */
  responseRate: number | null;
  averageRating: number | null;
  /** 1–2 star answers, which are the ones needing a person. */
  alerts: number;
}

export function summariseFeedback(
  rows: readonly { rating: number | null }[],
): FeedbackSummary {
  const answered = rows.filter((r) => r.rating != null && isValidRating(r.rating));
  const ratings = answered.map((r) => r.rating as number);
  return {
    asked: rows.length,
    answered: answered.length,
    responseRate: rows.length > 0 ? answered.length / rows.length : null,
    averageRating: averageRating(ratings),
    alerts: ratings.filter((r) => routeFeedback(r).urgency === "alert").length,
  };
}

/**
 * The question, in the guest's language.
 *
 * Here rather than in the email template because it is **not the hotel's wording to edit**. The
 * template body is theirs; this one line is attached to a five-point scale whose answers are counted,
 * averaged and compared across properties. A hotel rewriting it as "Did we exceed your
 * expectations?" would quietly change what the number means while the dashboard kept calling it the
 * same average.
 */
export function feedbackQuestion(locale: string | null | undefined, propertyName: string): string {
  return normaliseLocale(locale) === "bg"
    ? `Как беше престоят Ви в ${propertyName}?`
    : `How was your stay at ${propertyName}?`;
}

/** The small print under the stars: why answering is cheap. */
export function feedbackHint(locale: string | null | undefined): string {
  return normaliseLocale(locale) === "bg"
    ? "Едно докосване — без регистрация и без формуляри."
    : "One tap — no login, no forms.";
}

/** Bulgarian or English. An unknown locale gets English, never silence. */
function normaliseLocale(locale: string | null | undefined): "en" | "bg" {
  return locale?.trim().toLowerCase().startsWith("bg") ? "bg" : "en";
}

/**
 * The five star links for the post-stay email, lowest first.
 *
 * `baseUrl` is the booking engine's public origin — the guest has no login and no session, so the
 * page they land on is RevioDirect's, wearing the hotel's brand.
 *
 * The rating is in the path rather than a query string because some mail clients and link scanners
 * rewrite or strip query parameters, and a five-star answer arriving as an unrated click is worse
 * than no answer: it counts as a response with no rating.
 */
export function feedbackLinks(baseUrl: string, token: string): string[] {
  const origin = baseUrl.replace(/\/+$/, "");
  return [1, 2, 3, 4, 5].map((n) => `${origin}/feedback/${encodeURIComponent(token)}/${n}`);
}

/**
 * Clean a review destination the hotel pasted, or refuse it.
 *
 * ⚠️ These URLs are rendered as links on a **public, unauthenticated page**, so the scheme is a
 * security boundary and not a formatting preference. `javascript:` and `data:` URLs in an href are
 * script execution against every guest who clicks; `mailto:` and `tel:` are not review pages and
 * would silently do something the hotel did not intend.
 *
 * Only `http` and `https` survive. A bare `example.com/place` gets `https://` rather than being
 * rejected, because that is what a hotelier will paste and refusing it teaches them nothing.
 *
 * Returns `null` for anything unusable — and `null` means "no button", never a broken one.
 */
export function normaliseReviewUrl(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  // A scheme-less paste is the common case. Only assume https when there is no scheme at all —
  // never rewrite one we have decided to refuse.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // A URL with no host — `https:///review` — parses but links nowhere.
  if (!url.hostname) return null;
  return url.toString();
}

/** The public review buttons for a property, in the order a guest sees them. */
export function reviewDestinations(p: {
  reviewGoogleUrl?: string | null;
  reviewTripadvisorUrl?: string | null;
  reviewOwnUrl?: string | null;
  propertyName?: string;
}): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  // Google first: for most independents it is the single biggest lever on direct demand.
  const google = normaliseReviewUrl(p.reviewGoogleUrl);
  if (google) out.push({ label: "Review us on Google", url: google });
  const ta = normaliseReviewUrl(p.reviewTripadvisorUrl);
  if (ta) out.push({ label: "Review us on TripAdvisor", url: ta });
  const own = normaliseReviewUrl(p.reviewOwnUrl);
  if (own) out.push({ label: `Leave a review for ${p.propertyName ?? "us"}`, url: own });
  return out;
}
