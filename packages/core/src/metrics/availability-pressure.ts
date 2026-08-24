/**
 * How tight is a room type on a given day?
 *
 * The rule this replaces was `remaining <= 2`, a global integer. It reads correctly on a three-suite
 * demo and is wrong everywhere else: 2 of 3 suites is 67% of the type still open and not remotely
 * urgent, while 2 remaining on a 40-room type is effectively sold out and the only one that deserves
 * an alert. An absolute rule produces noise on small types and silence on big ones — the two failure
 * modes that between them train a user to ignore the colour entirely.
 *
 * So pressure is measured against the room type's own capacity. This is now load-bearing rather than
 * cosmetic: it is the Analytics availability heatmap's colour scale (§2.3) and the Inventory
 * Calendar's Remaining shading (§5.2), which must agree or the same day reads differently on two
 * screens.
 */

export type AvailabilityPressure =
  /** Sold beyond capacity — always urgent, at any size. */
  | "overbooked"
  /** Nothing left, but nothing oversold. */
  | "soldout"
  /** Tight enough to act on, relative to this room type. */
  | "low"
  /** Comfortable. */
  | "open";

/**
 * Below this share of capacity a type counts as tight.
 *
 * A judgement, not a fact, and deliberately one number in one place rather than a threshold spread
 * across two screens that would drift apart. 20% means the last 8 rooms of 40, and the last one of 5.
 */
export const LOW_AVAILABILITY_SHARE = 0.2;

/**
 * A floor for very small types.
 *
 * Pure percentage misbehaves at the bottom: on a 3-suite type, 20% is 0.6 rooms, so one remaining
 * (33%) would read as comfortable right up until it sold. One left is tight whatever the arithmetic
 * says.
 */
export const LOW_AVAILABILITY_MIN_ROOMS = 1;

export function availabilityPressure(remaining: number, capacity: number): AvailabilityPressure {
  if (remaining < 0) return "overbooked";
  if (remaining === 0) return "soldout";
  // No capacity but something remaining is not a state that should exist; treat it as open rather
  // than dividing by zero and colouring the cell on a NaN.
  if (capacity <= 0) return "open";
  if (remaining <= LOW_AVAILABILITY_MIN_ROOMS) return "low";
  return remaining / capacity <= LOW_AVAILABILITY_SHARE ? "low" : "open";
}

/** What share of the type is still sellable — the heatmap's underlying value. */
export function remainingShare(remaining: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, Math.min(1, remaining / capacity));
}
