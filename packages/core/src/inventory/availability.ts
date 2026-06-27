/**
 * Availability — the single most important data-model decision in the platform.
 *
 * Inventory is managed at the DATE level (a per-date "rooms to sell" allotment the hotel controls,
 * defaulting to the room type's physical Total Rooms when a date has no explicit value). Availability
 * for a (room type, date) is then COMPUTED:
 *   available = inventory - confirmedUnits        // "rooms to sell" minus "rooms sold"
 *
 * - "Rooms sold" (confirmedUnits) is always DERIVED from the live confirmed reservations, so a new
 *   booking lowers availability and a cancellation restores it for free — the allotment never has to
 *   be mutated by the booking flow (self-correcting; it can't drift).
 * - Stop Sell does NOT change this number. It is a separate flag that makes the channel-facing
 *   bookable count 0 without touching the underlying inventory.
 *
 * Pure functions only — see packages/core/CLAUDE.md.
 */

export interface AvailabilityInput {
  /** The date-level allotment ("rooms to sell"); defaults to the room's physical Total Rooms upstream. */
  inventory: number;
  /** Sum of confirmed reservation units (rooms sold) for this room type on this date. */
  confirmedUnits: number;
}

/** The true number of rooms left to sell, before any stop-sell flag. Never negative in normal flow. */
export function computeAvailability(input: AvailabilityInput): number {
  return input.inventory - input.confirmedUnits;
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
