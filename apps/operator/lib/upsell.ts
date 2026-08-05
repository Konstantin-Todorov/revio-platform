/**
 * What to sell this client next, and what it is worth — to them before us.
 *
 * Every SaaS admin console can list what a customer has not bought. That is not an opportunity, it is
 * a product matrix with gaps. What makes an opportunity is *evidence from their own data* that the
 * missing thing would pay for itself, and almost no vendor can produce that: their admin panel sees
 * logins and feature clicks, because their products are separate systems joined by integrations.
 *
 * Revio's one shared core is what changes here. The operator console holds the same reservations,
 * channels and commission rates the hotel sees, so an upsell can be *computed* rather than guessed —
 * and the number quoted in the sales call is the identical number the hotel can verify on their own
 * Cost of distribution screen. An upsell the customer can check is a different conversation from one
 * they have to take on faith.
 *
 * ## Two numbers, and the order matters
 *
 * `monthlyUpliftMinor` is what it adds to OUR MRR. `clientValueMinor` is what it is worth to THEM.
 * Both are on every opportunity, and the UI leads with theirs. A pitch built on our uplift is a
 * quota conversation; a pitch built on their saving is a business one — and where we cannot compute
 * their side honestly, `clientValueMinor` is **null** rather than a flattering estimate. Same rule as
 * `channelEconomics`: a number nobody can check is worth less than an admitted gap.
 */
import { MODULE_MINOR, MODULE_LABEL, tierDrift, type Entitlements } from "./pricing";

export type OpportunityKind = "plan_tier" | "add_reservation" | "add_pms" | "enable_direct" | "connect_channels";

export interface Opportunity {
  kind: OpportunityKind;
  title: string;
  /** Why this client, in one sentence, citing their own numbers. */
  rationale: string;
  /** Added to our monthly recurring revenue if they say yes. */
  monthlyUpliftMinor: number;
  /**
   * What it is worth to the hotel each month. `null` when it cannot be computed from their data —
   * an unquantified benefit is stated as such, never dressed up with an industry average.
   */
  clientValueMinor: number | null;
  /** The specific figures behind the claim, so a call can cite them. */
  evidence: string[];
  /** How firmly the data supports it. `strong` means it is arithmetic, not inference. */
  confidence: "strong" | "fair";
}

export interface UpsellSignals {
  plan: string;
  entitlements: Entitlements;
  /** Physical rooms across the account — what the pricing tier is meant to track. */
  rooms: number;
  properties: number;
  reservationsLast30d: number;
  /** From `channelEconomics` over the last 30 days — real money paid to OTAs. */
  commissionPaidLast30dMinor: number;
  /** Revenue-weighted OTA rate, or null when they have no OTA revenue to derive one from. */
  blendedOtaRatePct: number | null;
  directRevenueLast30dMinor: number;
  bookingEngineProperties: number;
  channelsConnected: number;
}

/** Hotels that book direct through an engine typically shift a slice of OTA volume across. We do not
 *  invent that slice: it is stated on screen as the assumption it is, and kept deliberately modest. */
const DIRECT_SHIFT_ASSUMPTION = 0.15;

export function clientOpportunities(s: UpsellSignals): Opportunity[] {
  const out: Opportunity[] = [];

  // --- expansion that already happened ------------------------------------
  const drift = tierDrift(s.plan, s.rooms);
  if (drift && drift.monthlyDeltaMinor > 0) {
    out.push({
      kind: "plan_tier",
      title: `Plan tier: ${drift.currentPlan} → ${drift.correctPlan}`,
      rationale: `They now run ${s.rooms} rooms across ${s.properties} propert${s.properties === 1 ? "y" : "ies"}, past the ${drift.currentPlan} tier.`,
      monthlyUpliftMinor: drift.monthlyDeltaMinor,
      // The hotel gets nothing new here — they already have the value, we simply under-billed. Saying
      // otherwise would be the kind of invented benefit this module exists to avoid.
      clientValueMinor: null,
      evidence: [`${s.rooms} rooms billed at the ${drift.currentPlan} tier`],
      confidence: "strong",
    });
  }

  // --- the one we can actually price for them ------------------------------
  // The strongest pitch in the product: their own commission, from their own channels' rates, on the
  // same figures their Cost of distribution screen shows them.
  if (s.bookingEngineProperties === 0 && s.commissionPaidLast30dMinor > 0 && s.blendedOtaRatePct != null) {
    const shiftable = Math.round(s.commissionPaidLast30dMinor * DIRECT_SHIFT_ASSUMPTION);
    out.push({
      kind: "enable_direct",
      title: "Switch on RevioDirect",
      rationale: `They paid €${(s.commissionPaidLast30dMinor / 100).toFixed(2)} in OTA commission last month and have no direct booking page.`,
      // RevioDirect is not separately billed — it is switched on per property. The uplift to us is
      // retention and expansion, not a line item, and pretending otherwise would inflate the pipeline.
      monthlyUpliftMinor: 0,
      clientValueMinor: shiftable,
      evidence: [
        `€${(s.commissionPaidLast30dMinor / 100).toFixed(2)} commission paid in 30 days`,
        `blended OTA rate ${s.blendedOtaRatePct.toFixed(1)}%`,
        `assumes ${Math.round(DIRECT_SHIFT_ASSUMPTION * 100)}% of that volume shifts direct — the one estimate here`,
      ],
      confidence: "fair", // the commission is fact; the share that moves is not
    });
  }

  // --- products they are visibly outgrowing --------------------------------
  if (!s.entitlements.reservation && s.reservationsLast30d >= 20) {
    out.push({
      kind: "add_reservation",
      title: `Add ${MODULE_LABEL.reservation}`,
      rationale: `${s.reservationsLast30d} bookings last month with no system of record — that volume is being managed somewhere else.`,
      monthlyUpliftMinor: MODULE_MINOR.reservation,
      clientValueMinor: null, // saved admin hours are real but not ours to quantify from data
      evidence: [`${s.reservationsLast30d} reservations in 30 days`, `${s.channelsConnected} connected channel(s)`],
      confidence: "strong",
    });
  }

  if (!s.entitlements.pms && s.entitlements.reservation && s.rooms >= 10) {
    out.push({
      kind: "add_pms",
      title: `Add ${MODULE_LABEL.pms}`,
      rationale: `${s.rooms} rooms being sold through RevioCRS with no front desk, housekeeping or folio on the same record.`,
      monthlyUpliftMinor: MODULE_MINOR.pms,
      clientValueMinor: null,
      evidence: [`${s.rooms} rooms`, `${s.reservationsLast30d} bookings in 30 days to check in by hand`],
      confidence: "strong",
    });
  }

  // --- value they bought and are not getting -------------------------------
  // Not new revenue, but the cheapest retention save there is: an unused product is the line a
  // finance director cuts first.
  if (s.entitlements.channelManager && s.channelsConnected === 0) {
    out.push({
      kind: "connect_channels",
      title: "Connect their first channel",
      rationale: "Billed for RevioLink with nothing connected — there is no value being delivered to defend at renewal.",
      monthlyUpliftMinor: 0,
      clientValueMinor: null,
      evidence: ["0 connected channels"],
      confidence: "strong",
    });
  }

  // Biggest uplift first, then the ones with a computed client value — a list ordered by what it is
  // worth is a call sheet; a list ordered by product name is a checklist.
  return out.sort(
    (a, b) => b.monthlyUpliftMinor - a.monthlyUpliftMinor || (b.clientValueMinor ?? 0) - (a.clientValueMinor ?? 0),
  );
}

/** Total monthly revenue on the table for this client, if every opportunity converted. */
export function pipelineMinor(ops: Opportunity[]): number {
  return ops.reduce((sum, o) => sum + o.monthlyUpliftMinor, 0);
}
