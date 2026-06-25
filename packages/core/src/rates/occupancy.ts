/**
 * Occupancy-based pricing. A rate plan's price is quoted for its base (max) occupancy; fewer guests
 * get an adjustment. Implements the questionnaire's "price for 2 guests − €10 = price for 1 guest".
 *
 * Pure functions only — see packages/core/CLAUDE.md.
 */

import {
  applyRounding,
  type AdjustmentDirection,
  type AdjustmentType,
  type RoundingRule,
} from "./derive.js";

export interface OccupancyAdjustment {
  /** Number of guests this price applies to. */
  occupancy: number;
  adjustmentType: AdjustmentType;
  direction: AdjustmentDirection;
  /** Percent (0–100) or minor units. */
  value: number;
  rounding?: RoundingRule;
}

/** Price (minor units) for a given occupancy, from the base price. No adjustment ⇒ base price. */
export function occupancyPrice(
  baseMinor: number,
  adjustment: OccupancyAdjustment | undefined,
): number {
  if (!adjustment) return baseMinor;
  const sign = adjustment.direction === "increase" ? 1 : -1;
  const delta =
    adjustment.adjustmentType === "percent"
      ? Math.round((baseMinor * adjustment.value) / 100)
      : adjustment.value;
  return applyRounding(baseMinor + sign * delta, adjustment.rounding);
}
