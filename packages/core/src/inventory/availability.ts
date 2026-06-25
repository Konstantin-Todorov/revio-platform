/**
 * Availability — the single most important data-model decision in the platform.
 *
 * Availability for a (room type, date) is COMPUTED:
 *   available = manualOverride ?? (totalInventory - confirmedUnits)
 *
 * - Every confirmed reservation decrements it; every cancellation restores it (because it is derived
 *   from the live confirmed count, this happens for free).
 * - A manual cell edit sets a NEW BASELINE that overrides the computed value until cleared.
 * - Stop Sell does NOT change this number. It is a separate flag that makes the channel-facing
 *   bookable count 0 without touching the underlying inventory.
 *
 * Pure functions only — see packages/core/CLAUDE.md.
 */

export interface AvailabilityInput {
  /** How many physical rooms of this type exist. */
  totalInventory: number;
  /** Sum of confirmed reservation units occupying this room type on this date. */
  confirmedUnits: number;
  /** A manually typed cell value that overrides the computed baseline, if any. */
  manualOverride?: number;
}

/** The true number of rooms left, before any stop-sell flag. Never negative in normal flow. */
export function computeAvailability(input: AvailabilityInput): number {
  const base =
    input.manualOverride ?? input.totalInventory - input.confirmedUnits;
  return base;
}

/**
 * What we actually tell a channel is bookable. Stop Sell forces 0 without changing availability;
 * a channel allocation (allotment) caps it; we never report a negative number to a channel.
 */
export function bookableForChannel(args: {
  availability: number;
  stopSell: boolean;
  /** Optional per-channel allotment ceiling. */
  channelAllocation?: number;
}): number {
  if (args.stopSell) return 0;
  const capped =
    args.channelAllocation === undefined
      ? args.availability
      : Math.min(args.availability, args.channelAllocation);
  return Math.max(0, capped);
}

/**
 * A booking that arrives after availability already hit zero is an "overbooked" sync-timing event,
 * not a data error — it must still be imported and surfaced for manual resolution.
 */
export function isOverbooking(availabilityBeforeBooking: number): boolean {
  return availabilityBeforeBooking <= 0;
}
