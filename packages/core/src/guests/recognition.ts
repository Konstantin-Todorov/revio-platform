/**
 * Recognising a returning guest — and the one thing this must never become.
 *
 * The platform already shares one guest record across RevioDirect, RevioCRS and RevioPMS, so a guest
 * who booked by phone last year and direct this year is the same row. That is the differentiator: a
 * booking engine bolted onto a foreign PMS would have to import stay history before it could greet
 * anyone, and would then hold a second, drifting copy of it.
 *
 * ## The refusal that shapes the design
 *
 * The obvious feature is a live lookup on step one: guest types an email, page answers "welcome back,
 * Ivan — your usual quiet room?". **We deliberately do not build that, and must not.** The booking
 * page is unauthenticated and internet-facing, so such an endpoint is a guest-enumeration oracle:
 * anyone could type addresses and learn, one request at a time, who has stayed at the hotel. For a
 * hotel that is not a minor leak — it exposes who slept where, which is exactly the fact guests most
 * expect a hotel to keep. Personalising a form field is not worth handing that out.
 *
 * So recognition is resolved **server-side, after a booking is submitted with that email**, and its
 * payoff lands where it is actually useful: the front desk sees a returning guest with their history
 * and their preferences before the guest reaches the counter. The guest-facing acknowledgement is a
 * warm sentence on the confirmation page — no personal data the guest did not just type.
 *
 * `recognitionOptOut` suppresses all of it. That is a narrower request than erasure and is treated as
 * such: a hotel must retain booking and invoice records regardless of what a guest prefers to be
 * called, so this flag changes what we *say*, never what we keep.
 */

export interface GuestRecognitionInput {
  /** Stays that are not this booking, in any status a hotel would count as "they came". */
  priorStayCount: number;
  /** Most recent prior check-in, `YYYY-MM-DD`, when there is one. */
  lastStayDate: string | null;
  /** The guest asked not to be recognised. */
  optedOut: boolean;
}

export interface GuestRecognition {
  /** True only when it is both true and permitted to say so. */
  isReturning: boolean;
  priorStayCount: number;
  lastStayDate: string | null;
  /**
   * What staff may be shown. Suppressed on opt-out — the front desk should not be told to greet
   * someone who asked not to be greeted, because the person reading the screen cannot know that.
   */
  staffSummary: string | null;
}

export function recogniseGuest(input: GuestRecognitionInput): GuestRecognition {
  // Opt-out is checked before anything else so there is exactly one place recognition can be
  // switched off, and no branch below can leak past it.
  if (input.optedOut || input.priorStayCount < 1) {
    return { isReturning: false, priorStayCount: input.priorStayCount, lastStayDate: input.lastStayDate, staffSummary: null };
  }

  // Ordinal, not a raw count: "4th stay" is what a receptionist says out loud, and it is the phrasing
  // that makes the number land as recognition rather than as a metric.
  const stayNumber = input.priorStayCount + 1;
  const summary = `Returning guest · ${ordinal(stayNumber)} stay${input.lastStayDate ? ` · last stayed ${input.lastStayDate}` : ""}`;

  return {
    isReturning: true,
    priorStayCount: input.priorStayCount,
    lastStayDate: input.lastStayDate,
    staffSummary: summary,
  };
}

/** 1st, 2nd, 3rd, 4th… including the 11th–13th exceptions English speakers notice immediately. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
