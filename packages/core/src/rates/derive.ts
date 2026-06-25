/**
 * Derived-rate engine. A rate plan's price computed from a parent rate plan, recalculated whenever
 * the parent changes (unless a specific date was manually overridden — handled by the caller).
 *
 *   Non-Refundable = Standard − 10%   ·   Breakfast = Standard + €12   ·   Trip.com = Standard − 5%
 *
 * Money is integer minor units. Pure functions only — see packages/core/CLAUDE.md.
 */

export type AdjustmentType = "percent" | "fixed";
export type AdjustmentDirection = "increase" | "decrease";

export type RoundingRule =
  | "none"
  | "nearest_minor_1" // nearest whole currency unit (e.g. nearest €1)
  | "nearest_minor_50" // nearest half unit (e.g. nearest €0.50)
  | "end_99"; // price ends in .99 (psychological pricing)

export interface DerivedRateConfig {
  /** The rate plan this price is calculated from. */
  parentRatePlanId: string;
  adjustmentType: AdjustmentType;
  direction: AdjustmentDirection;
  /** Percent (0–100) when type is "percent"; minor units when type is "fixed". */
  value: number;
  rounding?: RoundingRule;
  /** Never go below this (minor units). */
  floorMinor?: number;
  /** Never go above this (minor units). */
  ceilingMinor?: number;
}

/** A further adjustment applied only when sending to one channel — layered on top of the derived price. */
export interface ChannelPriceAdjustment {
  adjustmentType: AdjustmentType;
  direction: AdjustmentDirection;
  value: number;
  rounding?: RoundingRule;
}

function applyAdjustment(
  baseMinor: number,
  type: AdjustmentType,
  direction: AdjustmentDirection,
  value: number,
): number {
  const sign = direction === "increase" ? 1 : -1;
  if (type === "percent") {
    return baseMinor + sign * Math.round((baseMinor * value) / 100);
  }
  return baseMinor + sign * value;
}

export function applyRounding(minor: number, rule: RoundingRule = "none"): number {
  switch (rule) {
    case "none":
      return minor;
    case "nearest_minor_1":
      return Math.round(minor / 100) * 100;
    case "nearest_minor_50":
      return Math.round(minor / 50) * 50;
    case "end_99": {
      // Nearest value whose minor part is 99 (…11999, 12099, 12199).
      const k = Math.round((minor + 1) / 100);
      return k * 100 - 1;
    }
  }
}

function clamp(minor: number, floorMinor?: number, ceilingMinor?: number): number {
  let v = minor;
  if (floorMinor !== undefined) v = Math.max(v, floorMinor);
  if (ceilingMinor !== undefined) v = Math.min(v, ceilingMinor);
  return v;
}

/** Compute a derived price (minor units) from the parent price (minor units). */
export function deriveRate(parentMinor: number, config: DerivedRateConfig): number {
  const adjusted = applyAdjustment(
    parentMinor,
    config.adjustmentType,
    config.direction,
    config.value,
  );
  const rounded = applyRounding(adjusted, config.rounding);
  return clamp(rounded, config.floorMinor, config.ceilingMinor);
}

/** Apply a channel-specific price adjustment on send (distinct from currency markup). */
export function applyChannelAdjustment(
  priceMinor: number,
  adj: ChannelPriceAdjustment,
): number {
  const adjusted = applyAdjustment(
    priceMinor,
    adj.adjustmentType,
    adj.direction,
    adj.value,
  );
  return applyRounding(adjusted, adj.rounding);
}
