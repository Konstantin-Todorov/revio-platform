/**
 * A mapping that points at the right channel and the wrong room.
 *
 * ## The failure this catches, which nothing catches today
 *
 * Channex holds ONE rate plan per room type, and several of them are called the same thing — a
 * property with three apartments has three plans titled "BB BAR" differing only by a UUID. Pick the
 * wrong one and everything still looks finished: the mapping screen shows an external id, the status
 * says `mapped`, the push reports success, and Channex accepts every update. The only symptom is
 * that one room's prices and availability are published against another room.
 *
 * It has already happened twice on real property:
 *
 *   * 2026-09-13 — a €666 price set on the 1-Bedroom was published against the 2-Bedroom. The
 *     adapter was fixed to carry `room_type_id` so the picker could offer the right plans.
 *   * The bad rows that fix was written for were never repaired. On 2026-09-17, Cabacum Beach
 *     Residence still had `Apartment, 2 Bedrooms → Standard Rate` pointing at a rate plan Channex
 *     says belongs to `Apartment, 1 Bedroom`.
 *
 * ⚠️ **A collision check cannot find this.** `collidingExternalIds` asks whether two of our rooms
 * point at one plan; this asks whether one row points at the plan it claims to. The id here is used
 * exactly once and is still wrong. Only the channel's own `room_type_id` can say so, which is why
 * this compares against the catalogue rather than against ourselves.
 *
 * Pure: rows in, faults out.
 */

export interface MappedRate {
  /** Our room type — the one whose prices this row publishes. */
  roomTypeId: string;
  roomTypeName: string;
  ratePlanName: string;
  /** The channel's rate plan id we are pushing to. */
  externalRateId: string;
}

export interface ChannelRate {
  id: string;
  title: string;
  /**
   * The room type the CHANNEL says this plan belongs to. The authority.
   *
   * ⚠️ `null` means the channel did NOT say — not that the plan belongs to no room. A channel that
   * never scopes plans by room (our mock) answers null for every plan, and judging against that
   * would report every mapping in the demo as cross-wired. Unknown is skipped, never accused.
   */
  externalRoomId: string | null;
}

export interface CrossWired {
  roomTypeName: string;
  ratePlanName: string;
  externalRateId: string;
  /** What the channel calls the room this plan actually belongs to, or null when it is unknown. */
  belongsToRoomName: string | null;
  reason: "wrong_room" | "not_in_catalogue";
}

/**
 * Every mapping whose rate plan does not belong to the room type it is mapped under.
 *
 * @param ourRoomExternalId  our room type id → the channel's room id we mapped it to. A row whose
 *   room type is not mapped cannot be judged and is skipped: the fault there is the missing room
 *   mapping, which the screen already shows.
 */
export function crossWiredRatePlans(
  mapped: readonly MappedRate[],
  catalogue: readonly ChannelRate[],
  ourRoomExternalId: ReadonlyMap<string, string>,
  channelRoomName: ReadonlyMap<string, string> = new Map(),
): CrossWired[] {
  const byId = new Map(catalogue.map((r) => [r.id, r]));
  const out: CrossWired[] = [];

  for (const m of mapped) {
    if (!m.externalRateId) continue;
    const expectedRoom = ourRoomExternalId.get(m.roomTypeId);
    // No room mapping yet — judging the rate plan would report a second fault for one cause.
    if (!expectedRoom) continue;

    const plan = byId.get(m.externalRateId);
    if (!plan) {
      /*
       * The id is not in the channel's catalogue at all: a plan deleted or renamed on their side, or
       * a mapping copied from a different property. Pushes to it fail, and a push that fails is at
       * least loud — this is the milder of the two faults and is still worth naming.
       */
      out.push({
        roomTypeName: m.roomTypeName,
        ratePlanName: m.ratePlanName,
        externalRateId: m.externalRateId,
        belongsToRoomName: null,
        reason: "not_in_catalogue",
      });
      continue;
    }
    // The channel did not say which room this plan belongs to, so it cannot say we put it wrong.
    if (plan.externalRoomId == null) continue;
    if (plan.externalRoomId !== expectedRoom) {
      out.push({
        roomTypeName: m.roomTypeName,
        ratePlanName: m.ratePlanName,
        externalRateId: m.externalRateId,
        belongsToRoomName: channelRoomName.get(plan.externalRoomId) ?? null,
        reason: "wrong_room",
      });
    }
  }
  return out;
}

/** One sentence a hotelier can act on. Leads with the consequence, like every other message here. */
export function describeCrossWire(f: CrossWired): string {
  return f.reason === "wrong_room"
    ? `${f.roomTypeName} · ${f.ratePlanName} is publishing to a rate plan the channel says belongs to ` +
        `${f.belongsToRoomName ?? "another room"}. Those prices and that availability are going onto the wrong room.`
    : `${f.roomTypeName} · ${f.ratePlanName} points at rate plan ${f.externalRateId}, which the channel no longer has. ` +
        `Nothing sent for it is arriving.`;
}
