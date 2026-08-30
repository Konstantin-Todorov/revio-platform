import type { ChannexRestrictionValue } from "./channex-mappers.js";

/**
 * The per-occupancy half of the Channex ARI contract (CRS §6.7 / §6.7a).
 *
 * ## The crux, in one sentence
 *
 * A per-room plan sends `rate` (a scalar); a per-person plan sends `rates` (an array of
 * `{occupancy, rate}`) — **one change object carrying every occupancy**, not one object per
 * occupancy. Getting that wrong does not fail: Channex accepts N objects happily and multiplies a
 * year's push by the room's max occupancy, or accepts a scalar on a per-person plan and flattens
 * every party size to one price.
 *
 * ## Restrictions have no occupancy dimension
 *
 * min-stay, CTA, CTD and stop-sell sit at the TOP of the change object beside `rates`, not inside
 * it. That is Channex's shape and it is why the primary occupancy "carries" restrictions — there is
 * nowhere else for them to live. A UI offering per-occupancy min-stay would be promising something
 * the wire cannot express.
 *
 * ## Degrading for channels that cannot do it
 *
 * Not every OTA accepts per-occupancy rates. The honest failure is not to send nothing — it is to
 * send the PRIMARY occupancy's rate as a scalar, so the channel sells at a real price the hotel
 * chose, and to say so on the channel's limitations line. Silently sending per-person options to a
 * single-rate channel gets them dropped, and the hotel finds out from a booking at the wrong price.
 */

export interface OccupancyRate {
  occupancy: number;
  minor: number | null;
}

export type SellMode = "per_room" | "per_person";

/** Channex refuses a zero or negative rate per-object, inside an HTTP 200. Never send one. */
export function usableRates(rates: readonly OccupancyRate[]): { occupancy: number; rate: number }[] {
  return rates
    .filter((r): r is { occupancy: number; minor: number } => r.minor != null && r.minor > 0)
    .map((r) => ({ occupancy: r.occupancy, rate: r.minor }))
    .sort((a, b) => a.occupancy - b.occupancy);
}

export interface ApplyRatesInput {
  value: ChannexRestrictionValue;
  sellMode: SellMode;
  rates: readonly OccupancyRate[];
  /** The occupancy whose rate a single-rate channel gets. */
  primaryOccupancy: number;
  /** False for a channel that cannot express per-occupancy rates — degrade rather than drop. */
  channelSupportsOccupancy: boolean;
}

export type ApplyResult =
  | { ok: true; value: ChannexRestrictionValue; degraded: boolean }
  | { ok: false; reason: string };

/**
 * Put the rate(s) on a change object, in the shape this plan and this channel can actually take.
 *
 * Returns a refusal rather than a half-filled object when there is no usable price: an object with
 * restrictions and no rate is a valid, meaningful push (it changes only the restrictions), so a
 * caller must be told the difference between "nothing to price" and "priced".
 */
export function applyRates(input: ApplyRatesInput): ApplyResult {
  const usable = usableRates(input.rates);
  if (usable.length === 0) return { ok: false, reason: "no rate above zero to send" };

  const value = { ...input.value };

  if (input.sellMode === "per_room") {
    // One option at max occupancy is per-room's whole shape, so whichever single rate we hold is it.
    value.rate = usable[usable.length - 1]!.rate;
    delete value.rates;
    return { ok: true, value, degraded: false };
  }

  if (!input.channelSupportsOccupancy) {
    // Degrade to the primary, and say so. Falling back to the cheapest would undersell the hotel;
    // to the dearest would lose bookings. The primary is the price they nominated as the headline.
    const primary = usable.find((r) => r.occupancy === input.primaryOccupancy) ?? usable[usable.length - 1]!;
    value.rate = primary.rate;
    delete value.rates;
    return { ok: true, value, degraded: true };
  }

  value.rates = usable;
  // Mutually exclusive — leaving a stale scalar beside the array lets Channex pick.
  delete value.rate;
  return { ok: true, value, degraded: false };
}

/**
 * The `options[]` on a Channex rate plan — the shape of the plan, sent when it is created or changed.
 *
 * Distinct from the daily ARI push above: this says "this plan prices for 1, 2 and 3 guests", the
 * push says "and here is what each costs on the 14th". Sending prices without the options first
 * gives Channex rates for occupancies its rate plan does not have.
 */
export interface ChannexOccupancyOption {
  occupancy: number;
  is_primary: boolean;
  rate: number;
  derived_option?: { rate: [string, string][] };
}

export function toChannexOptions(
  rates: readonly OccupancyRate[],
  primaryOccupancy: number,
  fallbackMinor: number,
): ChannexOccupancyOption[] {
  const usable = usableRates(rates);
  if (usable.length === 0) return [];
  const hasPrimary = usable.some((r) => r.occupancy === primaryOccupancy);
  // Exactly one primary is a Channex requirement and ours. If the nominated one has no usable rate,
  // the largest occupancy takes it rather than the plan going out with none.
  const primary = hasPrimary ? primaryOccupancy : usable[usable.length - 1]!.occupancy;
  return usable.map((r) => ({
    occupancy: r.occupancy,
    is_primary: r.occupancy === primary,
    rate: r.rate > 0 ? r.rate : fallbackMinor,
  }));
}

/**
 * `derived_option` — ordered modifier rules applied left to right.
 *
 * `[["increase_by_percent","5"],["increase_by_amount","12"]]` takes 100 → 105 → 117. The order is
 * part of the meaning, so the array is never sorted or de-duplicated.
 */
export function toDerivedOption(
  adjustmentType: "percent" | "fixed" | null | undefined,
  direction: "increase" | "decrease" | null | undefined,
  value: number | null | undefined,
): { rate: [string, string][] } | undefined {
  if (adjustmentType == null || direction == null || value == null) return undefined;
  const verb = direction === "increase" ? "increase" : "decrease";
  const noun = adjustmentType === "percent" ? "percent" : "amount";
  return { rate: [[`${verb}_by_${noun}`, String(value)]] };
}

/**
 * Which `rate_mode` a plan is in — the two derivation axes, resolved to Channex's single field.
 *
 * `cascade` is the combination that needs the name: derived from a parent AND per-person, so every
 * occupancy follows the parent's matching occupancy. `derived` is the parent axis alone, where only
 * the primary follows. Sending `derived` for a per-person plan makes Channex derive one occupancy
 * and leave the rest — the parity failure, arrived at from inside the plan.
 */
export function resolveRateMode(hasParent: boolean, sellMode: SellMode): "manual" | "derived" | "cascade" {
  if (!hasParent) return "manual";
  return sellMode === "per_person" ? "cascade" : "derived";
}
