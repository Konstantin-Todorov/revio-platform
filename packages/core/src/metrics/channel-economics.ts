/**
 * What distribution actually costs, and what going direct actually saves.
 *
 * This is the arithmetic behind RevioDirect's commercial claim. A hotel does not buy a booking
 * engine because it is a booking engine; it buys one because someone showed it a number. So the
 * number has to survive being argued with.
 *
 * The whole module turns on one distinction, and every field name here keeps it visible:
 *
 *   **Commission PAID is a fact.** An OTA booking of €1,000 through a channel at 15% cost the hotel
 *   €150. That is money that left, derived from the channel's own configured rate and the revenue we
 *   recorded. No assumption is involved and none should be implied.
 *
 *   **Commission AVOIDED is a counterfactual.** A €1,000 direct booking carried no commission — but
 *   claiming €150 "saved" assumes that same guest would otherwise have booked through an OTA. Some
 *   would have; some were always going to call the hotel. Nobody can know the split.
 *
 * Collapsing those two into one "you saved €X" headline is what makes booking-engine marketing
 * untrustworthy, and this product's entire pitch is that its numbers are real. So they are returned
 * as separate fields, and the estimate is `null` — not zero, not a guess — whenever there is no OTA
 * revenue to derive a rate from. A hotel with no OTA channels has no basis for the comparison, and
 * inventing an industry-average 15% to fill the gap would be fabricating the headline figure.
 */

/** One reporting source's contribution over the period, already aggregated by the caller. */
export interface ChannelRevenueLine {
  /** The reporting source name shown to the hotel — "Booking.com", "Booking Engine". */
  sourceName: string;
  /** `BookingSource.category`: direct | ota | gds | call_center | corporate | travel_agent. */
  category: string;
  /**
   * The channel's own commission rate. `null` when the source has no mapped channel (a walk-in, the
   * booking engine, a phone reservation) — which is not the same as 0%, and is treated as "unknown"
   * rather than "free" everywhere below.
   */
  commissionPct: number | null;
  revenueMinor: number;
  roomNights: number;
  reservations: number;
}

export interface ChannelEconomicsRow extends ChannelRevenueLine {
  sharePct: number;
  /** Real commission on this source's revenue. 0 for direct; null when the rate is unknown. */
  commissionMinor: number | null;
}

export interface ChannelEconomics {
  directRevenueMinor: number;
  otaRevenueMinor: number;
  /** Everything that is neither direct nor OTA — corporate, travel agent, GDS, call centre. */
  otherRevenueMinor: number;
  totalRevenueMinor: number;
  /** Share of revenue booked direct. The number a hotel is trying to move. */
  directSharePct: number;
  /** Money that actually left for OTA commission. A fact, not a projection. */
  commissionPaidMinor: number;
  /** Net revenue after real commission — what the hotel actually kept. */
  netOfCommissionMinor: number;
  /**
   * Revenue-weighted average commission across OTA revenue — weighted, because a hotel that sells
   * mostly through a 12% channel and rarely through a 20% one does not face an average of 16%.
   * `null` when there is no OTA revenue in the period.
   */
  blendedOtaRatePct: number | null;
  /**
   * ESTIMATE. Direct revenue × the blended OTA rate: what direct bookings would have cost had they
   * arrived through the hotel's own channel mix. `null` when there is no OTA revenue, because then
   * there is no rate to reason from. Never present this without the assumption attached.
   */
  commissionAvoidedMinor: number | null;
  rows: ChannelEconomicsRow[];
}

/** `BookingSource.category` values that mean "an OTA took a cut". */
const OTA_CATEGORIES = new Set(["ota", "gds"]);
/** Categories the hotel owns outright — no intermediary, no commission. */
const DIRECT_CATEGORIES = new Set(["direct", "call_center"]);

/**
 * Is this source commission-free by nature?
 *
 * Exported because the UI must classify a row the same way the arithmetic does. Reading it off the
 * computed amount instead is a trap: a commissioned channel that happened to earn nothing in the
 * period also computes to zero commission, and rendering that as "commission-free" tells a hotel
 * that selling through an OTA is free. Zero-because-direct and zero-because-no-revenue are different
 * facts and only the category distinguishes them.
 */
export function isCommissionFreeCategory(category: string): boolean {
  return DIRECT_CATEGORIES.has(category);
}

export function channelEconomics(lines: readonly ChannelRevenueLine[]): ChannelEconomics {
  let directRevenueMinor = 0;
  let otaRevenueMinor = 0;
  let otherRevenueMinor = 0;
  let commissionPaidMinor = 0;
  // Only OTA revenue whose rate we actually know may weight the blended rate. Including revenue with
  // an unknown rate would silently drag the average toward zero and understate what distribution costs.
  let ratedOtaRevenueMinor = 0;

  for (const l of lines) {
    if (DIRECT_CATEGORIES.has(l.category)) {
      directRevenueMinor += l.revenueMinor;
    } else if (OTA_CATEGORIES.has(l.category)) {
      otaRevenueMinor += l.revenueMinor;
      if (l.commissionPct != null) {
        commissionPaidMinor += Math.round((l.revenueMinor * l.commissionPct) / 100);
        ratedOtaRevenueMinor += l.revenueMinor;
      }
    } else {
      otherRevenueMinor += l.revenueMinor;
    }
  }

  const totalRevenueMinor = directRevenueMinor + otaRevenueMinor + otherRevenueMinor;
  const blendedOtaRatePct =
    ratedOtaRevenueMinor > 0 ? (commissionPaidMinor / ratedOtaRevenueMinor) * 100 : null;

  const rows: ChannelEconomicsRow[] = lines
    .map((l) => ({
      ...l,
      sharePct: totalRevenueMinor > 0 ? (l.revenueMinor / totalRevenueMinor) * 100 : 0,
      commissionMinor: DIRECT_CATEGORIES.has(l.category)
        ? 0
        : l.commissionPct != null
          ? Math.round((l.revenueMinor * l.commissionPct) / 100)
          : null,
    }))
    .sort((a, b) => b.revenueMinor - a.revenueMinor);

  return {
    directRevenueMinor,
    otaRevenueMinor,
    otherRevenueMinor,
    totalRevenueMinor,
    directSharePct: totalRevenueMinor > 0 ? (directRevenueMinor / totalRevenueMinor) * 100 : 0,
    commissionPaidMinor,
    netOfCommissionMinor: totalRevenueMinor - commissionPaidMinor,
    blendedOtaRatePct,
    commissionAvoidedMinor:
      blendedOtaRatePct == null ? null : Math.round((directRevenueMinor * blendedOtaRatePct) / 100),
    rows,
  };
}
