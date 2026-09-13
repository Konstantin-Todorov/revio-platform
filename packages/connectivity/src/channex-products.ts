/**
 * What a Channex rate plan actually is, read from what the API returns.
 *
 * ## Why the mapping dropdown cannot just list them
 *
 * A Channex property's `/rate_plans` holds three different kinds of thing, and the Mapping screen
 * offered all of them as equally valid targets:
 *
 * 1. **A property rate plan** — `BB BAR`, belonging to one room type. The only correct target.
 * 2. **A channel-scoped entry** — `BB BAR - BookingCom Cabacum Beach Residence`. This is the
 *    Booking.com end of the chain, not a rate plan we push to. RevioLink talks to Channex; Channex
 *    talks to Booking.com. Binding to it skips a hop that exists for a reason.
 * 3. **A derived plan** — computed by Channex from a parent at an offset. Nothing is pushed to it.
 *
 * On 13 Sept the inactive `Standard Rate` was found mapped to `0ea321e7…`, which is a kind-2 entry
 * (BUG-020). Nothing rejected it, because nothing distinguished the kinds.
 *
 * ## ⚠️ The channel suffix is a heuristic, and is treated as one
 *
 * Channex does not flag these in a field we can rely on, so they are recognised by the ` - <Channel>`
 * suffix its UI generates. That is good enough to keep them out of a dropdown and NOT good enough to
 * act on silently, which is why the classification is returned rather than used to delete anything.
 */

/** Channel names Channex appends when it scopes a rate plan to one channel. */
const CHANNEL_SUFFIXES = [
  "BookingCom", "Booking.com", "Expedia", "Agoda", "AirBnB", "Airbnb", "TripAdvisor",
  "Trip.com", "Ctrip", "HotelBeds", "Hotelbeds", "WebBeds", "Despegar", "Hostelworld", "Vrbo",
];

export type ChannexRatePlanKind = "property" | "channel_scoped";

export interface ChannexRatePlan {
  id: string;
  name: string;
  /** The Channex room type this plan belongs to. Null when the API did not say. */
  roomTypeId: string | null;
  kind: ChannexRatePlanKind;
  /** Which channel it is scoped to, when it is. For explaining the exclusion, not for acting on. */
  channel?: string;
  /** Channex computes this one from a parent; nothing is ever pushed to it. */
  derived: boolean;
  /** What it derives from, when Channex said. */
  parentId?: string | null;
}

export function classifyChannexRatePlan(name: string): { kind: ChannexRatePlanKind; channel?: string } {
  // " - BookingCom Cabacum Beach Residence" → the segment after the LAST " - ".
  const at = name.lastIndexOf(" - ");
  if (at < 0) return { kind: "property" };
  const tail = name.slice(at + 3).trim();
  const hit = CHANNEL_SUFFIXES.find((c) => tail.toLowerCase().startsWith(c.toLowerCase()));
  return hit ? { kind: "channel_scoped", channel: hit } : { kind: "property" };
}

/**
 * Only what a hotel may map to: property plans, excluding derived ones.
 *
 * ⚠️ Derived plans are **excluded from the choices and reported separately**, not hidden. A plan you
 * cannot see is a plan you cannot reason about — the hotel needs to know BB NR exists and follows BB
 * BAR, or the screen's "1 unmapped" reads as a fault when it is a complete, correct state (BUG-021).
 */
export function mappableRatePlans(plans: readonly ChannexRatePlan[]): {
  mappable: ChannexRatePlan[];
  derived: ChannexRatePlan[];
  excluded: ChannexRatePlan[];
} {
  const mappable: ChannexRatePlan[] = [];
  const derived: ChannexRatePlan[] = [];
  const excluded: ChannexRatePlan[] = [];
  for (const p of plans) {
    if (p.kind === "channel_scoped") excluded.push(p);
    else if (p.derived) derived.push(p);
    else mappable.push(p);
  }
  return { mappable, derived, excluded };
}

/** The plans belonging to one Channex room type — what a room's dropdown may offer. */
export function ratePlansForRoom(plans: readonly ChannexRatePlan[], channexRoomTypeId: string): ChannexRatePlan[] {
  /*
   * ⚠️ A plan with no room type is NOT offered to every room.
   *
   * That is the property-wide assumption BUG-019 was made of. If Channex did not tell us which room
   * a plan belongs to, the honest answer is that we cannot place it — showing it under every room
   * is how a 1-Bedroom price came to be published against a 2-Bedroom.
   */
  return plans.filter((p) => p.roomTypeId === channexRoomTypeId);
}
