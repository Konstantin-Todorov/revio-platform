/**
 * What a client has done over twelve months, rather than what they are doing this instant.
 *
 * ## Why this is missing and worth adding
 *
 * Every figure on the client page is today's value: this month's price, the last thirty days'
 * bookings, the current error count. That is enough to answer "is anything wrong now" and useless
 * for the question a renewal call actually turns on — **is this getting better or worse.** A hotel
 * billing €118 a month is a different conversation depending on whether it was €59 in March or €180.
 *
 * ## Two decisions here that are not obvious
 *
 * **The series starts when the client did.** Padding twelve months of zeroes in front of a customer
 * who signed up in July draws a chart that looks like a collapse and reads as one. A short series is
 * honest; a long one full of zeroes is a claim about a period that did not exist.
 *
 * **"Paid" is net of refunds.** An invoice billed, paid and then refunded is not revenue, and the
 * `refundedMinor` column exists precisely because Stripe can send money back after the invoice says
 * paid. Drawing the gross would make a refunded month look like our best one.
 */

export interface TrendInvoice {
  period: string; // "YYYY-MM"
  amountMinor: number;
  status: string;
  refundedMinor: number;
}

export interface MonthBucket {
  label: string;
  value: number;
  secondary?: number;
}

/** `YYYY-MM` for the last `count` months, oldest first, ending with the month containing `now`. */
export function monthKeys(now: Date, count: number): string[] {
  const out: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * "2026-09" → "Sep". The chart has twelve of these side by side, so they have to be short.
 *
 * ⚠️ A fixed table, NOT `toLocaleString(…, { month: "short" })`. That returns "Sept" for September
 * under current ICU — four characters where every other month gives three — so the axis width would
 * shift under one label, and shift again on a different Node build. An axis whose spacing depends on
 * which month it is, and on the machine drawing it, is not an axis.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function monthLabel(key: string): string {
  const m = Number(key.split("-")[1]);
  return MONTHS[m - 1] ?? key;
}

/**
 * Billed per month, with paid-net-of-refunds as the inner overlay.
 *
 * ⚠️ The pair is deliberately a part and its whole — which is exactly what `TrendChart`'s
 * `secondary` series is documented for. Paid can never exceed billed here, so the overlay always
 * reads as a fraction of the bar rather than a competing quantity.
 */
export function billedSeries(invoices: readonly TrendInvoice[], months: readonly string[]): MonthBucket[] {
  const byMonth = new Map<string, { billed: number; paid: number }>();
  for (const i of invoices) {
    const b = byMonth.get(i.period) ?? { billed: 0, paid: 0 };
    b.billed += i.amountMinor;
    // Only a paid invoice contributes, and a refund takes it back. Floored at zero: a refund larger
    // than the invoice is a data fault, not negative revenue to draw below the axis.
    if (i.status === "paid") b.paid += Math.max(0, i.amountMinor - i.refundedMinor);
    byMonth.set(i.period, b);
  }
  return months.map((key) => {
    const b = byMonth.get(key);
    return { label: monthLabel(key), value: b?.billed ?? 0, secondary: b?.paid ?? 0 };
  });
}

/** Their bookings per month — our leading indicator, since their pipeline precedes our renewal. */
export function bookingSeries(countsByMonth: ReadonlyMap<string, number>, months: readonly string[]): MonthBucket[] {
  return months.map((key) => ({ label: monthLabel(key), value: countsByMonth.get(key) ?? 0 }));
}

/**
 * Trim leading months in which nothing at all happened.
 *
 * ⚠️ Leading only, never interior. A quiet month in the middle of a relationship is a fact worth
 * seeing — it is very often the fact — whereas months before the client existed are not a dip, they
 * are a period this customer was not in. Removing the first kind is honesty; removing the second
 * would be flattery.
 */
export function trimLeadingEmpty(buckets: readonly MonthBucket[]): MonthBucket[] {
  const first = buckets.findIndex((b) => b.value > 0 || (b.secondary ?? 0) > 0);
  return first <= 0 ? [...buckets] : buckets.slice(first);
}

/**
 * Trim several series to ONE shared window — the earliest month any of them has data.
 *
 * ⚠️ Trimming each series on its own is what the first version did, and looking at the rendered page
 * is the only reason it was caught: billed history began in March and bookings in August, so the two
 * charts drawn side by side had seven months and two. **Two charts on one row that do not share an
 * x-axis are not a comparison, they are two pictures**, and the reader draws a conclusion from their
 * shapes that nothing supports. The two-bar one also rendered as an enormous block, because a bar
 * chart with two buckets gives each half the width.
 *
 * The window starts where the RELATIONSHIP starts, which is the earliest evidence of it in any
 * series. Months before that are not a quiet period, they are a period this client did not exist in.
 */
export function alignSeries(series: readonly (readonly MonthBucket[])[]): MonthBucket[][] {
  const firsts = series
    .map((s) => s.findIndex((b) => b.value > 0 || (b.secondary ?? 0) > 0))
    .filter((i) => i >= 0);
  const from = firsts.length === 0 ? 0 : Math.min(...firsts);
  return series.map((s) => s.slice(from));
}

export interface MrrMovement {
  /** Signed minor units: what their monthly price has done since the earliest month we billed them. */
  deltaMinor: number;
  fromMinor: number;
  toMinor: number;
  /** The month the comparison starts at, e.g. "Mar". Null when there is nothing to compare against. */
  since: string | null;
}

/**
 * What their monthly price has done, and from when.
 *
 * ⚠️ Compares against the earliest month we actually billed, not against a fixed twelve months ago.
 * "Flat since September" on a client onboarded in September is true and useless; naming the month
 * makes the reader do the arithmetic that gives the sentence its meaning.
 *
 * Returns `null` rather than a zero movement when there is one invoice or none — a change needs two
 * points, and drawing "+€0" for a brand-new client states a comparison that was never made.
 */
export function mrrMovement(invoices: readonly TrendInvoice[], currentMonthlyMinor: number): MrrMovement | null {
  const billed = [...invoices].filter((i) => i.amountMinor > 0).sort((a, b) => a.period.localeCompare(b.period));
  if (billed.length === 0) return null;
  const earliest = billed[0]!;
  // One invoice and the current price are two points only if they differ in month; otherwise the
  // comparison is the invoice against itself.
  if (billed.length === 1 && earliest.amountMinor === currentMonthlyMinor) return null;
  return {
    fromMinor: earliest.amountMinor,
    toMinor: currentMonthlyMinor,
    deltaMinor: currentMonthlyMinor - earliest.amountMinor,
    since: monthLabel(earliest.period),
  };
}

/**
 * Is there any history here at all?
 *
 * ⚠️ A brand-new client has twelve months of zeroes in both series, and `TrendChart` only shows its
 * own "No data yet" when handed an EMPTY array — twelve zero-height bars is not empty, it is a flat
 * line along the axis, which reads as a rendering fault rather than as a new customer.
 *
 * This page already settled that argument for the waitlist and the booking engine: a section with
 * nothing to report is not shown, "rather than a confident €0 that reads as a product failing".
 * Same rule, same reason.
 */
export function hasHistory(series: readonly (readonly MonthBucket[])[]): boolean {
  return series.some((s) => s.some((b) => b.value > 0 || (b.secondary ?? 0) > 0));
}
