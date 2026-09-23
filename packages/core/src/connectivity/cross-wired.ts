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

/**
 * The same question, asked of what we wrote down instead of of the channel.
 *
 * `crossWiredRatePlans` needs the channel's live catalogue, which only a screen that already fetches
 * it can afford. The Operator console shows every client at once and cannot make an API call per
 * client per render — so the nightly audit records the channel's answer on each mapping row, and
 * this reads it back.
 *
 * ⚠️ **Only CERTAIN faults.** A row is reported when the channel named a room for the plan, we know
 * which channel room our room type is, and the two differ. Every other combination is silence:
 *
 *   * never checked → we have not asked, which is not evidence of anything
 *   * checked, no room named → the channel would not place the plan (it may not scope plans by room
 *     at all), and an unknown is not a wrong answer
 *   * our room type unmapped → the fault is the missing room mapping, already named elsewhere
 *
 * This is deliberately more cautious than the live check. A false accusation on a console somebody
 * reads before phoning a customer costs more than a missed one, because the missed one comes back
 * tomorrow night and the false one gets acted on.
 */
export interface RecordedMapping {
  roomTypeId: string;
  roomTypeName: string;
  ratePlanName: string;
  externalRateId: string | null;
  /** What the channel said this plan belongs to, as of `checkedAt`. */
  externalRoomIdSeen: string | null;
  /** When the channel was last asked. Null = never. */
  checkedAt: Date | null;
  /**
   * Whether the hotel still has this rate plan switched on.
   *
   * ⚠️ REQUIRED rather than optional, and that is the whole point of adding it: both callers had to
   * be changed, which is what the compiler is for. A plan that is switched off is not pushed —
   * `syncChannel` has filtered on this since 2026-09-17 — so it cannot be publishing anywhere, and
   * a mapping it left behind is a thing to tidy rather than a fault doing damage. Reporting it as a
   * cross-wire says prices are going to the wrong room right now, which is false, and says it in
   * red on the page somebody reads before telephoning the customer.
   *
   * ⚠️ **Corrected 2026-09-23.** A day earlier this comment said a pause would stop-sell "the WRONG
   * room" through such a mapping. It does not: `pushStopSellOverlay` closes every mapped room, so
   * there is no wrong one, and `resumeChannel` re-opens through `syncChannel`, which skips
   * switched-off plans — so the stale rate correctly stays closed. What IS true is narrower: whatever
   * the channel last received for the rate is frozen there, and re-enabling the plan would publish
   * through a mapping nobody has checked. That is what the stale-mapping alert now says.
   */
  active: boolean;
}

export interface RecordedCrossWire {
  roomTypeName: string;
  ratePlanName: string;
  externalRateId: string;
  checkedAt: Date;
}

export function crossWiredFromRecord(
  rows: readonly RecordedMapping[],
  ourRoomExternalId: ReadonlyMap<string, string>,
): RecordedCrossWire[] {
  const out: RecordedCrossWire[] = [];
  for (const r of rows) {
    if (!r.checkedAt || !r.externalRateId || !r.externalRoomIdSeen) continue;
    // A plan nobody publishes cannot publish to the wrong room. The leftover mapping is still worth
    // clearing, and is reported as a stale mapping — one line per plan, at the severity it deserves.
    if (!r.active) continue;
    const expected = ourRoomExternalId.get(r.roomTypeId);
    if (!expected || expected === r.externalRoomIdSeen) continue;
    out.push({
      roomTypeName: r.roomTypeName,
      ratePlanName: r.ratePlanName,
      externalRateId: r.externalRateId,
      checkedAt: r.checkedAt,
    });
  }
  return out;
}
