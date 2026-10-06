/**
 * Which channel rate plan a (room type, rate plan) pair pushes to.
 *
 * Channex ties a rate plan to exactly one room type; we model rate plans at property level, so one
 * "Standard Rate" covers every room type a hotel has. Reconciling the two is this function's whole
 * job, and getting it wrong is invisible: the push succeeds, the Sync Center is green, and two of
 * the hotel's three room types are priced wrong on every OTA.
 *
 * Two kinds of mapping row, and the order matters:
 *
 *   room-specific (`roomTypeId` set) — the correct shape for Channex. One row per (plan, room).
 *   catch-all (`roomTypeId` null)    — what every row was before this existed, and what the mock
 *                                      channels still mean. Applies to any room type.
 *
 * Exact match wins. Falling back the other way would let a stale catch-all silently override the
 * specific mapping somebody deliberately created.
 */

export interface RatePlanMappingRow {
  ratePlanId: string;
  /** Null = applies to any room type. */
  roomTypeId: string | null;
  externalRateId: string | null;
}

/**
 * Index the mappings for lookup by (roomTypeId, ratePlanId).
 *
 * Built once per push rather than scanned per cell: a 365-day push across 6 room types and 7 plans
 * is 15,330 lookups, and a linear scan of the mapping list on each is the kind of quiet O(n²) that
 * only shows up on the biggest hotel.
 */
export function indexRateMappings(
  rows: readonly RatePlanMappingRow[],
  opts?: {
    /**
     * Whether a property-wide row may stand in for a room that has none.
     *
     * ⚠️ **False for every real channel.** A catch-all cannot express which room a Channex rate plan
     * belongs to, so pushing through one means knowingly publishing a price that may land on the
     * wrong room — which is what happened on 13 September, where €666 set on the 1-Bedroom was
     * published against the 2-Bedroom. A wrong price on an OTA is a booking taken at the wrong rate:
     * worse than no price at all, because no price is visible and a wrong one is not.
     *
     * True for mock channels, where a catch-all is the normal and correct shape — the mock adapter
     * invents and reads back its own ids, and has no per-room model to disagree with.
     *
     * The pair then resolves to null, which the push already treats as "skip and report unmapped",
     * so the hotel sees it on the Mapping screen and in the channel's own unmapped count rather
     * than losing prices silently.
     */
    allowCatchAll?: boolean;
  },
) {
  const allowCatchAll = opts?.allowCatchAll ?? true;
  const specific = new Map<string, RatePlanMappingRow>();
  const catchAll = new Map<string, RatePlanMappingRow>();
  for (const r of rows) {
    if (r.roomTypeId) specific.set(`${r.roomTypeId}|${r.ratePlanId}`, r);
    else if (allowCatchAll) catchAll.set(r.ratePlanId, r);
  }
  return { specific, catchAll };
}

export type RateMappingIndex = ReturnType<typeof indexRateMappings>;

/**
 * The external rate id for one (room type, rate plan), or null when this pair is not mapped.
 *
 * **Null means "do not push this pair"**, and that is the safe answer. The alternative — falling back
 * to some other room type's rate plan because it shares a name — is exactly the bug this file exists
 * to remove: it produces a push that succeeds while writing one room type's price onto another's.
 */
export function resolveExternalRateId(
  index: RateMappingIndex,
  roomTypeId: string,
  ratePlanId: string,
): string | null {
  const hit = index.specific.get(`${roomTypeId}|${ratePlanId}`) ?? index.catchAll.get(ratePlanId);
  return hit?.externalRateId ?? null;
}

/**
 * Is this channel fully mapped for the products it carries?
 *
 * A per-room-type model makes "all mapped" a harder claim than it was: a plan mapped once, for one
 * room type, used to satisfy the check while the hotel's other room types reached no channel at all.
 * Green here has to mean every pair that could be pushed can be.
 */
export function unmappedPairs(
  index: RateMappingIndex,
  roomTypeIds: readonly string[],
  ratePlanIds: readonly string[],
): { roomTypeId: string; ratePlanId: string }[] {
  const gaps: { roomTypeId: string; ratePlanId: string }[] = [];
  for (const roomTypeId of roomTypeIds) {
    for (const ratePlanId of ratePlanIds) {
      if (!resolveExternalRateId(index, roomTypeId, ratePlanId)) gaps.push({ roomTypeId, ratePlanId });
    }
  }
  return gaps;
}

/**
 * Which (channel room, channel rate) pairs a STOP-SELL has to close.
 *
 * ## Why this is not the ARI pairing
 *
 * `pushStopSellOverlay` used to send every mapped room × every mapped rate — including pairs that do
 * not exist at the channel, a rate belonging to the 1-Bedroom addressed to the 2-Bedroom. On a
 * three-room property that is roughly two pairs in three the channel cannot place. They closed
 * nothing, but they made the push's result permanently "rejected", which is why nobody could read
 * the result — and so nobody did: a pause answered "all dates closed" whatever the channel said.
 *
 * ## …and why it is not quite the ARI pairing either
 *
 * The ARI push refuses a property-wide ("catch-all") rate mapping on a real channel, because
 * publishing a PRICE through one can land it on the wrong room — the €666 of 13 September. A
 * stop-sell points the other way. Closing too much is the safe error; closing too little leaves a
 * rate on sale that somebody pressed Pause to stop. So here a room-specific mapping pairs only with
 * its own room, and a catch-all pairs with every room: the extra pairs may be refused, and that is a
 * price worth paying to be sure the one that exists is closed.
 *
 * Switched-off plans are NOT excluded, deliberately. The ARI push skips them, so whatever the channel
 * last received for them is frozen there; a pause has to close that too.
 */
export function stopSellPairs(
  roomMaps: readonly { roomTypeId: string; externalRoomId: string | null }[],
  rateMaps: readonly RatePlanMappingRow[],
): { externalRoomId: string; externalRateId: string }[] {
  const index = indexRateMappings(rateMaps, { allowCatchAll: true });
  const planIds = [...new Set(rateMaps.map((m) => m.ratePlanId))];
  const seen = new Set<string>();
  const out: { externalRoomId: string; externalRateId: string }[] = [];
  for (const room of roomMaps) {
    if (!room.externalRoomId) continue;
    for (const planId of planIds) {
      const externalRateId = resolveExternalRateId(index, room.roomTypeId, planId);
      if (!externalRateId) continue;
      const key = `${room.externalRoomId}|${externalRateId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ externalRoomId: room.externalRoomId, externalRateId });
    }
  }
  return out;
}

/**
 * The (room, channel rate) pairs a SWITCHED-OFF plan still occupies at the channel — to be closed.
 *
 * The ARI push skips a plan the hotel has switched off, which is right for prices: a plan Revio no
 * longer sells must not be advertised. But "skip" left whatever the channel last received frozen
 * there, OPEN, at the last price — and Channex keeps ARI until it is told otherwise, so an OTA went
 * on selling a rate nobody in the hotel thought was for sale. Worse, a room whose every plan was
 * switched off stopped receiving availability at all, so its last room count froze too and the
 * channel could sell a room already taken. Each push now closes these pairs (stop-sell, no price,
 * no room count); switching the plan back on reopens it, because its normal push states `stopSell`.
 *
 * ⚠️ Never a rate an ACTIVE mapping also points at. A stale mapping often aims at another room's
 * channel rate (Cabacum, 17 September), and closing that would stop a plan the hotel is selling.
 * Room-specific rows only: a property-wide row cannot say which room its rate belongs to.
 */
export function switchedOffClosures(
  roomMaps: readonly { roomTypeId: string; externalRoomId: string | null }[],
  switchedOff: readonly RatePlanMappingRow[],
  live: readonly RatePlanMappingRow[],
): { roomTypeId: string; ratePlanId: string; externalRoomId: string; externalRateId: string }[] {
  const liveRates = new Set(live.map((m) => m.externalRateId).filter((id): id is string => Boolean(id)));
  const roomOf = new Map(roomMaps.filter((r) => r.externalRoomId).map((r) => [r.roomTypeId, r.externalRoomId!] as const));
  const seen = new Set<string>();
  const out: { roomTypeId: string; ratePlanId: string; externalRoomId: string; externalRateId: string }[] = [];
  for (const m of switchedOff) {
    if (!m.roomTypeId || !m.externalRateId || liveRates.has(m.externalRateId)) continue;
    const externalRoomId = roomOf.get(m.roomTypeId);
    if (!externalRoomId) continue;
    const key = `${externalRoomId}|${m.externalRateId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ roomTypeId: m.roomTypeId, ratePlanId: m.ratePlanId, externalRoomId, externalRateId: m.externalRateId });
  }
  return out;
}
