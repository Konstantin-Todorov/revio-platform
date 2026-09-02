/**
 * Operator-side pricing model — what we charge hotels, and the only place it is decided.
 *
 * The price has three parts, and each one is priced on a different thing on purpose:
 *
 *   PLATFORM FEE   priced by ROOM COUNT. This is cost-to-serve — the shared database, row-level
 *                  isolation, backups, the availability engine, support. A 200-room resort costs
 *                  more to carry than a 12-room guesthouse whatever it has bought.
 *   MODULE FEE     priced per PRODUCT. This is value — what each product does for them.
 *   BUNDLE         a discount that grows with the number of modules, because the second and third
 *                  products cost us almost nothing to deliver: same database, same onboarding, same
 *                  support relationship, and no migration. That is the entire architectural bet, so
 *                  the price list should say it out loud. It is also the answer to "why not buy a
 *                  cheap channel manager and a separate PMS" — three vendors cost more than our three.
 *
 * Plus one usage component (`DIRECT_BOOKING_FEE_PCT`) on RevioDirect, which is the only place we earn
 * more when the customer earns more.
 *
 * Money is integer minor units (cents), EUR.
 */

export type Entitlements = { channelManager: boolean; reservation: boolean; pms: boolean };
export type ProductKey = keyof Entitlements;

export const PRODUCT_KEYS = ["channelManager", "reservation", "pms"] as const;

/** Plan tier base fee (room-count tier uplift). starter is the entry tier. */
export const PLAN_BASE_MINOR: Record<string, number> = { starter: 0, growth: 5000, scale: 15000, enterprise: 30000 };

/**
 * The plan a client's ROOM COUNT says they should be on.
 *
 * The tiering has been the stated model since the first architecture note — "CM priced by room-count
 * tier: 0–30, 31–50, 50–100" — but nothing ever computed it, so `plan` was whatever was typed at
 * onboarding and never moved again. A hotel that opened a second building stayed on Starter forever.
 *
 * That is the quietest revenue leak a vertical SaaS has: expansion that already happened, unbilled,
 * because nobody re-counted. We are the ones holding the room count, so we are the ones who can see
 * it drift — and a tier change is the easiest possible upsell conversation, because the customer has
 * already taken the value.
 */
export const ROOM_TIERS = [
  { plan: "starter", label: "0–30 rooms", maxRooms: 30 },
  { plan: "growth", label: "31–50 rooms", maxRooms: 50 },
  { plan: "scale", label: "51–100 rooms", maxRooms: 100 },
  { plan: "enterprise", label: "100+ rooms", maxRooms: Number.POSITIVE_INFINITY },
] as const;

export function tierForRooms(rooms: number): (typeof ROOM_TIERS)[number] {
  return ROOM_TIERS.find((t) => rooms <= t.maxRooms) ?? ROOM_TIERS[ROOM_TIERS.length - 1]!;
}

export interface TierDrift {
  currentPlan: string;
  correctPlan: string;
  rooms: number;
  /** Positive = we are under-billing them. Negative = they shrank and are over-paying. */
  monthlyDeltaMinor: number;
}

/**
 * Has the room count outgrown (or fallen behind) the plan being billed?
 *
 * Returns `null` when they match. Under-billing is revenue to collect; **over-billing is reported
 * just as plainly**, because a hotel that closed a wing and is still paying the bigger tier will
 * find out eventually, and finding out from us is the difference between a credit note and a
 * cancellation.
 */
export function tierDrift(currentPlan: string, rooms: number): TierDrift | null {
  const correct = tierForRooms(rooms);
  if (correct.plan === currentPlan) return null;
  return {
    currentPlan,
    correctPlan: correct.plan,
    rooms,
    monthlyDeltaMinor: (PLAN_BASE_MINOR[correct.plan] ?? 0) - (PLAN_BASE_MINOR[currentPlan] ?? 0),
  };
}

export const MODULE_MINOR: Record<ProductKey, number> = { channelManager: 4900, reservation: 5900, pms: 6900 };
export const MODULE_LABEL: Record<ProductKey, string> = { channelManager: "RevioLink", reservation: "RevioCRS", pms: "RevioPMS" };
export const MODULE_SHORT: Record<ProductKey, string> = { channelManager: "CM", reservation: "CRS", pms: "PMS" };

/**
 * Discount on the MODULE fees, by how many modules are bought. Never on the platform fee — that is
 * cost-to-serve, and it does not get cheaper because they bought more software.
 *
 * Deliberately steepest at the third product. The whole platform thesis is "land with one, expand
 * with zero migration"; if the third module were priced the same as the first, the price list would
 * be arguing against the architecture.
 */
export const BUNDLE_DISCOUNT_PCT: Record<number, number> = { 0: 0, 1: 0, 2: 10, 3: 20 };

export const DIRECT_BOOKING_FEE_PCT = 2;
/**
 * The billing basis for the fee above: bookings **our engine produced**, not every direct booking.
 *
 * `BookingSource.category = "direct"` also covers the phone, walk-ins and the front desk — business
 * the hotel won on its own, which we have no claim on. Charging for those would make the fee feel
 * like a tax on their own guests, which is exactly the resentment OTAs create.
 */
export const BOOKING_ENGINE_SOURCE_NAME = "Booking Engine";
/**
 * What an OTA typically takes, for the comparison that justifies the fee above. Booking.com and
 * Expedia sit at 15–18%; every euro RevioDirect moves direct saves them roughly 13 of those points.
 * We are the cheapest channel they have, and we only earn more when they earn more.
 */
export const TYPICAL_OTA_COMMISSION_PCT = 15;

export function entitledKeys(ent: Entitlements): ProductKey[] {
  return PRODUCT_KEYS.filter((k) => ent[k]);
}

export interface PriceBreakdown {
  platformMinor: number;
  modules: { key: ProductKey; label: string; minor: number }[];
  moduleSubtotalMinor: number;
  discountPct: number;
  /** Always reported as a positive number; subtracted from the subtotal. */
  discountMinor: number;
  totalMinor: number;
}

/**
 * The full derivation of one client's monthly price, kept as a structure rather than a number so the
 * pricing page can show the arithmetic instead of asserting a total. A price a customer cannot
 * reconstruct is a price they will argue with on the call.
 */
export function priceBreakdown(plan: string, ent: Entitlements): PriceBreakdown {
  const platformMinor = PLAN_BASE_MINOR[plan] ?? 0;
  const modules = entitledKeys(ent).map((key) => ({ key, label: MODULE_LABEL[key], minor: MODULE_MINOR[key] }));
  const moduleSubtotalMinor = modules.reduce((s, m) => s + m.minor, 0);
  const discountPct = BUNDLE_DISCOUNT_PCT[modules.length] ?? 0;
  const discountMinor = Math.round((moduleSubtotalMinor * discountPct) / 100);
  return {
    platformMinor, modules, moduleSubtotalMinor, discountPct, discountMinor,
    totalMinor: platformMinor + moduleSubtotalMinor - discountMinor,
  };
}

/** Monthly price for a client. The single source — invoices, MRR and every screen go through here. */
export function monthlyPriceMinor(plan: string, ent: Entitlements): number {
  return priceBreakdown(plan, ent).totalMinor;
}

/** Comma-separated product names a client is billed for (empty string if none). */
export function billedProducts(ent: Entitlements): string {
  return entitledKeys(ent).map((k) => MODULE_LABEL[k]).join(", ");
}

// --- the seven ways to buy it ----------------------------------------------

export interface Combination {
  /** Stable key, e.g. "cm+pms". */
  key: string;
  label: string;
  products: ProductKey[];
  /** Who this shape is actually for — the sentence a salesperson says. */
  who: string;
}

const ENT = (...keys: ProductKey[]): Entitlements => ({
  channelManager: keys.includes("channelManager"),
  reservation: keys.includes("reservation"),
  pms: keys.includes("pms"),
});

export function entitlementsFor(products: ProductKey[]): Entitlements {
  return ENT(...products);
}

export function combinationKeyOf(ent: Entitlements): string {
  const keys = entitledKeys(ent);
  return keys.length === 0 ? "none" : keys.map((k) => MODULE_SHORT[k].toLowerCase()).join("+");
}

/**
 * Every non-empty combination, ordered the way the business actually sells: the single products
 * first (that is how a client lands), then the pairs, then the platform.
 *
 * `CM + PMS` is the odd one and is labelled as such rather than quietly listed. A hotel with
 * distribution and operations but no system of record keeps its bookings in RevioLink's own
 * reservation list, which works, but it is a gap worth naming on a call — it is the one combination
 * where the next sale is obvious.
 */
export const COMBINATIONS: Combination[] = [
  { key: "cm", label: "RevioLink", products: ["channelManager"], who: "Has a PMS already, needs OTA sync. The landing product." },
  { key: "crs", label: "RevioCRS", products: ["reservation"], who: "Small property, direct business only, no OTA needs." },
  { key: "pms", label: "RevioPMS", products: ["pms"], who: "Wants an operations layer over a system they keep." },
  { key: "cm+crs", label: "RevioLink + RevioCRS", products: ["channelManager", "reservation"], who: "Distribution plus the system of record. The natural pair." },
  { key: "crs+pms", label: "RevioCRS + RevioPMS", products: ["reservation", "pms"], who: "Runs the whole hotel, sells direct only." },
  { key: "cm+pms", label: "RevioLink + RevioPMS", products: ["channelManager", "pms"], who: "Unusual — no system of record between the two. Sell them RevioCRS." },
  { key: "cm+crs+pms", label: "Full platform", products: ["channelManager", "reservation", "pms"], who: "Everything on one core. The lowest price per product." },
];

// --- attributing revenue to products ---------------------------------------

/**
 * Split `totalMinor` across `weights` so the parts sum to EXACTLY the total.
 *
 * Largest-remainder: floor every share, then hand the leftover cents to the largest fractional
 * parts. The naive version — round each share independently — loses or invents money, and on a
 * revenue-by-product chart that shows up as a total which disagrees with MRR by a few cents and
 * makes every other number on the page suspect.
 */
export function splitProportionally(totalMinor: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalMinor * w) / sum);
  const shares = exact.map(Math.floor);
  let remainder = totalMinor - shares.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let n = 0; remainder > 0; n++, remainder--) shares[order[n % order.length]!.i]! += 1;
  return shares;
}

export interface RevenueAttribution {
  byProduct: Record<ProductKey, number>;
  /** Platform fee from a client that has bought nothing — real revenue, belonging to no product. */
  unallocatedMinor: number;
  totalMinor: number;
}

/**
 * How much of one client's monthly price each product "earned".
 *
 * **This is a convention, not a fact, and the page says so.** Once a bundle discount exists there is
 * no true answer to which product gave up the discount, and the platform fee is not a product's at
 * all. The convention: split the whole price across the entitled products in proportion to their
 * list module fee. Simple, stable, and it cannot disagree with MRR — `splitProportionally` guarantees
 * the parts sum to the total exactly.
 */
export function attributeRevenue(plan: string, ent: Entitlements): RevenueAttribution {
  const totalMinor = monthlyPriceMinor(plan, ent);
  const keys = entitledKeys(ent);
  const byProduct: Record<ProductKey, number> = { channelManager: 0, reservation: 0, pms: 0 };
  if (keys.length === 0) return { byProduct, unallocatedMinor: totalMinor, totalMinor };
  const shares = splitProportionally(totalMinor, keys.map((k) => MODULE_MINOR[k]));
  keys.forEach((k, i) => { byProduct[k] = shares[i]!; });
  return { byProduct, unallocatedMinor: 0, totalMinor };
}

/** Our cut of the direct revenue RevioDirect produced. Round half up, on the client's own number. */
export function directBookingFeeMinor(directRevenueMinor: number): number {
  return Math.round((directRevenueMinor * DIRECT_BOOKING_FEE_PCT) / 100);
}


// --- The plan a client is actually on ------------------------------------------------

export interface PlanOverride {
  plan: string;
  reason: string;
  by: string | null;
  at: Date | null;
}

export type PlanBasis = "derived" | "overridden";

export interface EffectivePlan {
  /** The plan to bill on. */
  plan: string;
  basis: PlanBasis;
  /** What the room count says it should be. Present even when overridden — that IS the comparison. */
  derivedPlan: string;
  rooms: number;
  /** Set only when an override is in force AND it disagrees with the room count. */
  override: PlanOverride | null;
  /** Positive = the override bills MORE than the room count implies; negative = less. */
  overrideDeltaMinor: number;
}

/**
 * Which plan a client is on, and why.
 *
 * ## The problem this replaces
 *
 * `plan` was a free dropdown with a Save button, while a whole panel elsewhere detected that the
 * billed tier disagreed with the room count. **The console was manufacturing the problem it then
 * measured.** A hotel that opened a second building stayed on Starter forever, because nothing moved
 * the value and nobody was told.
 *
 * So the tier is now DERIVED from rooms, always. An override still exists — a negotiated deal or a
 * group ramping up are real — but it is an explicit, attributed, reasoned exception rather than a
 * value somebody typed once in 2025. That turns "unbilled tier drift" from a number an operator has
 * to remember to look at into an exception with a name, a date and a reason attached.
 */
export function effectivePlan(
  rooms: number,
  override: PlanOverride | null | undefined,
): EffectivePlan {
  const derivedPlan = tierForRooms(Math.max(0, rooms)).plan;

  // An override that AGREES with the room count is not an override — it is a coincidence, and
  // showing it as an exception would train people to ignore the badge that matters.
  if (!override || override.plan === derivedPlan) {
    return { plan: derivedPlan, basis: "derived", derivedPlan, rooms, override: null, overrideDeltaMinor: 0 };
  }

  return {
    plan: override.plan,
    basis: "overridden",
    derivedPlan,
    rooms,
    override,
    overrideDeltaMinor: (PLAN_BASE_MINOR[override.plan] ?? 0) - (PLAN_BASE_MINOR[derivedPlan] ?? 0),
  };
}

/** "overridden by Ventsislav · 12 Aug · group deal" — an exception with a name on it. */
export function describeOverride(o: PlanOverride): string {
  const who = o.by ?? "someone";
  const when = o.at
    ? o.at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : "an unknown date";
  return `overridden by ${who} · ${when} · ${o.reason}`;
}
