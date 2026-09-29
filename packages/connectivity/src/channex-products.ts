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

/**
 * Where each plan in the channel gets its price — the whole catalogue, not only what we mapped.
 *
 * ## Why this exists (founder, 2026-09-29)
 *
 * The first production read-back reported 186 prices "we did not send" on Cabacum, and it took
 * reading the raw catalogue to see they were all Channex's own Booking.com copies — correct, and not
 * ours to map. The founder asked the obvious question: shouldn't we be mapping those? Nobody could
 * answer it from the Mapping screen, because the screen only showed the plans we map TO. A hotel
 * looking at twelve plans in Channex and six rows in Revio has the same question and no answer.
 *
 * So every plan gets one role, read from what the channel says about it:
 *
 * - `ours`         mapped, and the channel takes our price — the normal case
 * - `ours_ignored` mapped, but the channel computes it from a parent — our price is thrown away
 * - `ota_mapped`   mapped to a channel's own OTA copy — skips a hop; should point at the plan above it
 * - `derived`      not mapped, computed from a parent — follows it by itself, nothing to do
 * - `ota_copy`     not mapped, the channel's copy for one OTA — follows its parent, nothing to do
 * - `unused`       not mapped, and nothing feeds it — no price from Revio reaches it
 */
export type ChannelPlanRole = "ours" | "ours_ignored" | "ota_mapped" | "derived" | "ota_copy" | "unused";

export interface ChannelPlanLine {
  id: string;
  name: string;
  role: ChannelPlanRole;
  /** Our plan(s) mapped to it, for `ours*` / `ota_mapped`. */
  revioPlans: string[];
  /** The plan it is computed from or copies, when the channel said. */
  parent: string | null;
  /** Which OTA, for the OTA copies. */
  channel?: string;
}

export interface ChannelPlanRoom {
  /** The channel's room id; null for plans it did not place in a room. */
  roomId: string | null;
  roomName: string | null;
  plans: ChannelPlanLine[];
}

const ROLE_ORDER: Record<ChannelPlanRole, number> = { ours: 0, ours_ignored: 1, ota_mapped: 2, derived: 3, ota_copy: 4, unused: 5 };

export function explainChannelPlans(
  plans: readonly (ChannexRatePlan & { parentId?: string | null })[],
  mapped: readonly { externalRateId: string; ratePlanName: string }[],
  rooms: readonly { id: string; name: string }[],
): ChannelPlanRoom[] {
  const nameOf = new Map(plans.map((p) => [p.id, p.name] as const));
  const ours = new Map<string, string[]>();
  for (const m of mapped) {
    const list = ours.get(m.externalRateId) ?? [];
    if (!list.includes(m.ratePlanName)) list.push(m.ratePlanName);
    ours.set(m.externalRateId, list);
  }
  const lines = plans.map((p): ChannelPlanLine & { roomId: string | null } => {
    const revioPlans = ours.get(p.id) ?? [];
    const parent = p.parentId ? nameOf.get(p.parentId) ?? null : null;
    const isOta = p.kind === "channel_scoped";
    const role: ChannelPlanRole = revioPlans.length > 0
      ? isOta ? "ota_mapped" : p.derived ? "ours_ignored" : "ours"
      : isOta ? "ota_copy" : p.derived ? "derived" : "unused";
    return { id: p.id, name: p.name, role, revioPlans, parent, ...(p.channel ? { channel: p.channel } : {}), roomId: p.roomTypeId };
  });

  const roomName = new Map(rooms.map((r) => [r.id, r.name] as const));
  const groups = new Map<string | null, ChannelPlanLine[]>();
  for (const { roomId, ...line } of lines) groups.set(roomId, [...(groups.get(roomId) ?? []), line]);
  return [...groups.entries()]
    .map(([roomId, list]) => ({
      roomId,
      roomName: roomId ? roomName.get(roomId) ?? null : null,
      plans: list.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)),
    }))
    // Rooms in the channel's own name order; plans it could not place, last.
    .sort((a, b) => (a.roomId === null ? 1 : b.roomId === null ? -1 : (a.roomName ?? "").localeCompare(b.roomName ?? "")));
}
