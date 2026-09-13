/**
 * The first invoice — charged from the day the customer actually started paying, not from the 1st.
 *
 * ## The promise this keeps
 *
 * "30 days free" has to mean 30 days. Billing whole calendar months breaks that at exactly one
 * point: the month a trial converts in. Converting sets `endedAt = now` and keeps the entitlement,
 * so from that instant the product is no longer "on trial" and the month's invoice prices it in
 * full — including the days earlier in that month that were free. A trial converted on the 29th
 * billed the whole month. The same held for an assisted client who went live on the 28th.
 *
 * ## Why prorate rather than pick a side
 *
 * Both alternatives are defensible and both are worse:
 *
 * - **Bill the whole month.** We keep the money and hand every converting customer a wrong-looking
 *   invoice at the worst possible moment — the first one. That conversation costs more than the
 *   days do, and it contradicts the sentence on our own signup page.
 * - **Start billing on the 1st of the next month.** Honest, but gives away up to a month per
 *   customer for nothing.
 *
 * Proration is what the hotel market actually does. **SiteMinder** and **Little Hotelier** — both
 * direct competitors, both no-card trials, both calendar-month invoicing — issue a first invoice
 * containing the prorated remainder of the calendar month after the trial ends, then full months.
 * Stripe, Chargebee and Paddle all reach the same outcome by a different route (they move the
 * billing anchor to the trial end instead of prorating), and all three refuse to bill trial days.
 *
 * We keep calendar months, because hotels do monthly accounting and one invoice date across the
 * portfolio is worth keeping, and we prorate the joining month. That is the SiteMinder shape.
 *
 * ## What is NOT prorated
 *
 * The RevioDirect usage fee. It is 2% of bookings our engine actually produced, so it is already
 * only what happened — scaling it by a fraction of the month would charge a share of bookings
 * rather than the bookings themselves. The caller narrows its DATE RANGE instead.
 */

/** Days in the calendar month of a `YYYY-MM` period. */
export function daysInPeriod(period: string): number {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Not a billing period: "${period}". Expected YYYY-MM.`);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export interface Proration {
  /** Days actually billed in this period. */
  billedDays: number;
  /** Days the period has. */
  totalDays: number;
  /** The first day charged, as `YYYY-MM-DD` — what the invoice line says. */
  from: string;
}

/**
 * How much of `period` this client is billed for, or `null` for an ordinary full month.
 *
 * `firstBillableDay` is the first day we may charge for. It is deliberately the caller's decision
 * (see `firstBillableDay` below) because two different facts feed it and only one of them lives on
 * the tenant row.
 *
 * ⚠️ Returns `null` — meaning "bill the full month" — when the first billable day is BEFORE this
 * period. A period that is entirely before it should never have reached here; `isBillablePeriod`
 * refuses those, and this returns a zero-day proration if one slips through rather than silently
 * charging a full month for a month the client had not joined.
 */
export function prorationFor(period: string, firstBillableDay: Date | null): Proration | null {
  if (!firstBillableDay) return null;
  const totalDays = daysInPeriod(period);
  const startPeriod = firstBillableDay.toISOString().slice(0, 7);
  if (startPeriod < period) return null; // joined earlier — an ordinary full month
  if (startPeriod > period) return { billedDays: 0, totalDays, from: firstBillableDay.toISOString().slice(0, 10) };

  const day = firstBillableDay.getUTCDate();
  return {
    // Inclusive of the joining day itself: somebody who converts on the 30th of a 30-day month gets
    // one day, not zero. An exclusive count would charge nothing for the day they actually started.
    billedDays: totalDays - day + 1,
    totalDays,
    from: firstBillableDay.toISOString().slice(0, 10),
  };
}

/**
 * Apply a proration to a monthly amount, in minor units.
 *
 * Rounds to the nearest cent and **never exceeds the full amount** — a clamp rather than a hope,
 * because `billedDays` coming from a bad date would otherwise scale the price up.
 */
export function proratedMinor(fullMinor: number, p: Proration | null): number {
  if (!p) return fullMinor;
  if (p.billedDays <= 0) return 0;
  if (p.billedDays >= p.totalDays) return fullMinor;
  return Math.min(fullMinor, Math.round((fullMinor * p.billedDays) / p.totalDays));
}

/**
 * The first day a tenant may be charged for.
 *
 * ⚠️ **Two conditions, and dropping either one charges for something we said was free.**
 *
 * 1. `billingStartsAt` — we do not bill before the platform has done anything for them. With
 *    channel management that is the first synced booking; without it, finished setup.
 * 2. The end of any free trial. `markBillable` does not ask about trials, so a booking syncing
 *    during a free trial stamps `billingStartsAt` in the middle of it. Taking the later of the two
 *    is what stops those trial days being billed.
 *
 * `trialEndedAt` is the latest trial end among the products being billed this period — the point
 * from which everything on the invoice was genuinely paid-for.
 */
export function firstBillableDay(
  billingStartsAt: Date | null,
  trialEndedAt: Date | null,
): Date | null {
  if (!billingStartsAt) return null;
  if (!trialEndedAt) return billingStartsAt;
  return trialEndedAt > billingStartsAt ? trialEndedAt : billingStartsAt;
}

/** "20–30 September (11 of 30 days)" — what the invoice line has to say, in the customer's words. */
export function prorationNote(p: Proration | null): string | null {
  if (!p || p.billedDays >= p.totalDays) return null;
  if (p.billedDays <= 0) return "not billable in this period";
  return `from ${p.from} — ${p.billedDays} of ${p.totalDays} days`;
}
