/**
 * How confidently may a derived statistic describe itself?
 *
 * A guest profile shows "Average stay 3.0 nights", "Usual room 404", "Booking frequency 1 stay" —
 * all computed from a single visit. "Average" and "usual" both claim a pattern established by
 * repetition; at n=1 there is no pattern, only the one value that happened. The number is correct
 * and the word around it is not, which is the worse kind of wrong: it reads as insight and it is
 * arithmetic on a sample of one.
 *
 * The same threshold the room-assignment logic already uses — never infer a preference from a single
 * stay — now stated once so the profile and the assigner cannot disagree about what counts as known.
 */

/**
 * Two stays. One is an anecdote; two is the beginning of a habit.
 *
 * Not a statistically defensible number and it does not pretend to be. It is the point at which the
 * word "usual" stops being a lie, which is the only thing this threshold decides.
 */
export const MIN_STAYS_FOR_PATTERN = 2;

export function hasPattern(stays: number): boolean {
  return stays >= MIN_STAYS_FOR_PATTERN;
}

/**
 * The label for a derived statistic, given how much history it rests on.
 *
 * `pattern` is the confident form ("Average stay"); `single` is the honest one ("Last stay"). Both
 * are supplied by the caller because the honest form is not a mechanical transformation of the
 * confident one — "Booking frequency" does not become "Last frequency".
 */
export function sampleLabel(stays: number, pattern: string, single: string): string {
  return hasPattern(stays) ? pattern : single;
}

/**
 * The sample size, when it is worth showing.
 *
 * Returned only for small samples: annotating "· 14 stays" on a well-established average is noise,
 * while "· 1 stay" beside an average is the whole caveat. Null means "say nothing".
 */
export function sampleNote(stays: number): string | null {
  if (stays <= 0) return null;
  if (hasPattern(stays) && stays > 3) return null;
  return `${stays} stay${stays === 1 ? "" : "s"}`;
}
