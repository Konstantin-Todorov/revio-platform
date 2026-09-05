import type { WaitlistStatus } from "../waitlist/waitlist.js";

/**
 * What the waitlist actually recovered.
 *
 * One function, read by the CRS dashboard and by the Operator's upsell pitch — the same rule that
 * already stops the quote and the push disagreeing. A number we quote a hotel in a renewal call has
 * to be one they can open their own screen and verify.
 *
 * ## Why there are two rates and not one "conversion rate"
 *
 * They answer different questions and a single number silently picks one:
 *
 * - **`offerConversionRate` = converted ÷ offered.** How good the offer is once we manage to make
 *   one. This is a measure of *us* — the wording, the four-hour window, the claim link.
 * - **`demandRecoveryRate` = converted ÷ entries.** How much of the demand we actually served. This
 *   is mostly a measure of *the hotel's cancellations* — most entries never get an offer because
 *   nothing ever came free, and that is not a failure of the feature.
 *
 * Report one alone and it flatters or damns the feature depending which you picked. A hotel with one
 * cancellation all month converting it has an offer conversion of 100% and a demand recovery of 3%,
 * and both of those sentences are true and worth knowing.
 *
 * ## Money
 *
 * `recoveredMinor` is the accommodation value of the stays these entries became — **passed in, never
 * re-derived**. The caller has the reservation; a second computation here could disagree with the
 * folio the hotel is looking at, and "revenue recovered" disagreeing with the booking it names is
 * worse than not showing it.
 */

export interface WaitlistEntryMetricFact {
  status: WaitlistStatus;
  /** When they joined. Queue position is derived from this, so it always exists. */
  createdAt: Date;
  /**
   * When we last offered them something, or `null` if we never did.
   *
   * ⚠️ The LATEST offer, not the first — `WaitlistEntry.offeredAt` is overwritten on each offer and
   * the earlier timestamps are not stored. For an entry offered once, which is the great majority,
   * the two are the same. Storing a separate `firstOfferedAt` would sharpen `medianMinutesToOffer`
   * and is the obvious follow-up if that number is ever used to make a decision.
   */
  offeredAt: Date | null;
  /** Offers made to this entry across its life. */
  offerCount: number;
  /**
   * Accommodation value of the stay this became, in minor units — `null` when it did not become one,
   * and also when it did but the reservation has since been removed (`reservationId` is `SET NULL`).
   * Those two are counted apart, so revenue is never quietly understated.
   */
  recoveredMinor: number | null;
}

export interface WaitlistMetrics {
  entries: number;
  /** Entries that received at least one offer. */
  offered: number;
  /** Offers made in total — an entry offered three times counts three. */
  offersMade: number;
  converted: number;
  /** Converted, but the stay behind it is gone, so it contributes no revenue. */
  convertedWithoutValue: number;
  stillWaiting: number;
  expired: number;
  cancelled: number;
  /** converted ÷ offered. `null` when nothing has been offered — not zero. */
  offerConversionRate: number | null;
  /** converted ÷ entries. `null` when there are no entries — not zero. */
  demandRecoveryRate: number | null;
  /** Accommodation value recovered, minor units. */
  recoveredMinor: number;
  /**
   * Median minutes from joining to being offered a room, over entries that were offered one.
   *
   * Median rather than mean: a single entry that sat for three weeks before a cancellation freed
   * anything would drag a mean far past anything a guest actually experienced.
   */
  medianMinutesToOffer: number | null;
}

/** Middle value; the average of the two middle ones for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function waitlistMetrics(entries: readonly WaitlistEntryMetricFact[]): WaitlistMetrics {
  let offered = 0;
  let offersMade = 0;
  let converted = 0;
  let convertedWithoutValue = 0;
  let stillWaiting = 0;
  let expired = 0;
  let cancelled = 0;
  let recoveredMinor = 0;
  const minutesToOffer: number[] = [];

  for (const e of entries) {
    offersMade += Math.max(0, e.offerCount);

    /*
     * "Offered" is `offeredAt != null`, not `status === "offered"`.
     *
     * A status is where the entry is NOW: an entry that was offered a room and converted reads
     * `converted`, and one whose offer lapsed reads `waiting` again. Counting the status would
     * therefore report the offer conversion rate over only the entries whose offer is still open —
     * which excludes, by construction, every offer that actually worked.
     */
    if (e.offeredAt != null) {
      offered++;
      const minutes = (e.offeredAt.getTime() - e.createdAt.getTime()) / 60_000;
      // A negative reading is a clock problem, not a fast offer. Floored rather than dropped, so one
      // skewed row cannot quietly shrink the sample the median is taken over.
      minutesToOffer.push(Math.max(0, Math.round(minutes)));
    }

    switch (e.status) {
      case "converted":
        converted++;
        if (e.recoveredMinor == null) convertedWithoutValue++;
        else recoveredMinor += e.recoveredMinor;
        break;
      case "waiting":
        stillWaiting++;
        break;
      case "expired":
        expired++;
        break;
      case "cancelled":
        cancelled++;
        break;
      case "offered":
        // An open offer is still in play — neither a win nor a loss yet, so it is counted only in
        // `offered` above.
        break;
    }
  }

  return {
    entries: entries.length,
    offered,
    offersMade,
    converted,
    convertedWithoutValue,
    stillWaiting,
    expired,
    cancelled,
    // `null`, never 0. "No offers have been made" and "every offer failed" are different facts, and
    // rendering both as 0% tells a hotel their waitlist does not work when it has not yet been asked.
    offerConversionRate: offered > 0 ? converted / offered : null,
    demandRecoveryRate: entries.length > 0 ? converted / entries.length : null,
    recoveredMinor,
    medianMinutesToOffer: median(minutesToOffer),
  };
}
