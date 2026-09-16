import { fmtDay } from "./calendar.js";

/**
 * Which dates a field may offer, and why "most places, not all".
 *
 * ## The defect this exists for
 *
 * A restriction, a bulk price, an out-of-order period and a calendar cell all commit **future**
 * inventory. Writing one into a date that has gone does nothing a hotel wants: the night is sold or
 * it is not, the money is taken or it is not, and the only thing that actually happens is that we
 * push a rate for a past date to Booking.com, which either rejects it or — worse — accepts it and
 * puts our channel out of step with theirs over a date nobody will ever check.
 *
 * Yet a report that cannot look at last month is as broken as a calendar that can sell yesterday.
 * So this is a **classification, not a blanket rule**, and the classification is the part worth
 * writing down — otherwise someone "fixes" the reports next quarter and nobody notices for a month.
 *
 * ## The four intents
 *
 * | Intent | Means | Examples |
 * | --- | --- | --- |
 * | `forward-only` | today or later | restriction rules, bulk edits, calendar cells, OOO periods, a new stay |
 * | `keep-existing` | today or later, **except** it may stay where it already is | the arrival of a guest who checked in on Tuesday |
 * | `history` | anything, including the past | reservation search, dashboards, reports, a note about a call |
 * | `not-future` | today or **earlier** | a date of birth, a passport issue date |
 *
 * `keep-existing` is the one that cannot be skipped. An in-house guest arrived yesterday; that is a
 * fact, not a mistake. Forcing their arrival forward to edit their *departure* would rewrite a stay
 * that has already happened — so the floor for an existing record is the earlier of today and the
 * value it already holds. You can never push a date further into the past than it already is, and
 * you are never blocked from editing a record because time passed.
 *
 * ## ⚠️ "Today" means today AT THE PROPERTY
 *
 * Not the server's UTC date and not the browser's. A Sofia hotel is UTC+3 in summer, so between
 * midnight and 03:00 local — the night auditor's shift, which is exactly when Close Day runs — a
 * UTC-derived "today" is **yesterday**. That is not a theoretical drift: it is three hours every
 * single night during which a screen would default to a date it then refuses, or offer one it
 * should not. `todayInTimeZone` is the only correct source, and it needs the property's zone.
 */

export type DateIntent = "forward-only" | "keep-existing" | "history" | "not-future";

/**
 * The property's own calendar date — the ONE definition of "today" this platform uses.
 *
 * `en-CA` because its short format is ISO `YYYY-MM-DD`, which is what every date column, every
 * `<input type="date">` and every Channex payload already speaks.
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * The floor for a date field: what goes in `min`, and what the server compares against.
 *
 * `existing` is the value the record already holds. Passing it turns `forward-only` into
 * `keep-existing` — see the table above.
 */
export function earliestSelectable(today: string, existing?: string | null): string {
  if (!existing) return today;
  return existing < today ? existing : today;
}

/**
 * The refusal, in the words the screen shows — or `null` when the date is fine.
 *
 * ⚠️ This is the **server's** check, and it is not optional just because the input carries a `min`.
 * `min` is a hint to a date picker: it does not survive a typed value in every browser, a replayed
 * form post, or a client component that submits its state through an action. The input stops people
 * trying; this stops it happening.
 */
export function pastDateRefusal(opts: {
  /**
   * How the screen names this field, capitalised — "The start date", "Arrival".
   *
   * Omit it where the field has no name worth saying, such as a calendar cell that IS a date: then
   * the message leads with the date itself rather than inventing a noun to hang it on.
   */
  label?: string;
  iso: string;
  earliest: string;
}): string | null {
  const { label, iso, earliest } = opts;
  if (!iso || iso >= earliest) return null;
  const subject = label ? `${label} of ${fmtDay(iso)}` : fmtDay(iso);
  return `${subject} has already passed. The earliest you can pick is ${fmtDay(earliest)}.`;
}

/** Both ends of a range, refused in reading order so the reader fixes the first problem first. */
export function pastRangeRefusal(opts: {
  from: string;
  to: string;
  earliest: string;
  fromLabel?: string;
  toLabel?: string;
}): string | null {
  return (
    pastDateRefusal({ label: opts.fromLabel ?? "The start date", iso: opts.from, earliest: opts.earliest }) ??
    pastDateRefusal({ label: opts.toLabel ?? "The end date", iso: opts.to, earliest: opts.earliest })
  );
}

/** The reverse guard: a date of birth in the future is a typo, always. */
export function futureDateRefusal(opts: { label: string; iso: string; today: string }): string | null {
  const { label, iso, today } = opts;
  if (!iso || iso <= today) return null;
  return `${label} of ${fmtDay(iso)} is in the future. Check the date — it cannot be later than ${fmtDay(today)}.`;
}

/**
 * What the clock in `timeZone` reads at instant `at`, expressed as its offset from UTC in ms.
 *
 * Derived from `Intl` rather than from a table, so it is correct across DST changes and for any zone
 * the runtime knows, with no data to keep up to date.
 */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // `hour` is "24" at midnight in some runtimes; `% 24` normalises it to 0.
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return wallAsUtc - at.getTime();
}

/**
 * The UTC instants that bound one calendar day **at the property**.
 *
 * ## Why this exists
 *
 * Counting "how many bookings came in today" by `Date.UTC(...getUTCDate())` buckets by the SERVER's
 * day. For a Bulgarian hotel that is wrong for the first three hours of every day: a booking taken
 * at 01:00 in Sofia is 22:00 UTC yesterday, so the dashboard reports it as yesterday's — and 00:00
 * to 03:00 is the night auditor's shift, which is exactly when somebody is reading that number.
 *
 * It shipped on the RevioLink dashboard's Reservation Summary card, whose entire purpose is a
 * Today/Yesterday toggle.
 *
 * ⚠️ Not `new Date(\`${date}T00:00:00Z\`)` either. That is midnight UTC, which is 03:00 in Sofia —
 * the same error with a different sign.
 *
 * DST-correct: the offset is resolved at the instant the day actually begins, then re-resolved once
 * in case crossing the boundary changed it, which is what happens on the two nights a year the
 * clocks move.
 */
export function dayBoundsInTimeZone(date: string, timeZone: string): { start: Date; next: Date } {
  const wall = Date.parse(`${date}T00:00:00Z`);
  const first = new Date(wall - zoneOffsetMs(timeZone, new Date(wall)));
  // One correction pass: on a DST night the offset at the corrected instant differs from the offset
  // at the guess, and the corrected instant is the one that matters.
  const start = new Date(wall - zoneOffsetMs(timeZone, first));

  const nextWall = Date.parse(`${date}T00:00:00Z`) + 86_400_000;
  const nextFirst = new Date(nextWall - zoneOffsetMs(timeZone, new Date(nextWall)));
  const next = new Date(nextWall - zoneOffsetMs(timeZone, nextFirst));
  return { start, next };
}
