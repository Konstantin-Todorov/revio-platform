/**
 * Which occupancy a "plain" rate write belongs to.
 *
 * ## Why this exists
 *
 * `RatePrice` is keyed by `(room type, rate plan, date, occupancy)` since OBP H1. Ten call sites
 * across the CRS and RevioLink predate that dimension and mean "the" price for a room — the
 * calendar cell, the bulk editor, the quote. Under a per-room plan that IS a real occupancy: the
 * room's ceiling, the one-row special case.
 *
 * They could each have written `roomType.maxGuests` inline. They must not, for one reason: when a
 * plan is per-person, "the" price is the **primary** occupancy, which is not necessarily the
 * ceiling. Ten inline copies of the wrong assumption is exactly how one surface gets left behind and
 * quotes a different number from the rest — the parity failure the spec names.
 *
 * So the answer is resolved once, here, and every caller asks.
 *
 * ⚠️ Resolve it ONCE per operation, not once per row. A bulk edit is dates × plans × room types and
 * an extra query inside that loop is thousands of round trips for a value that cannot change during
 * the operation. `occupancyKeysFor` takes the whole set for that reason.
 */

export interface OccupancyKeySource {
  roomType: {
    findMany(args: unknown): Promise<{ id: string; maxGuests: number; defaultOccupancy: number | null }[]>;
  };
}

/**
 * The occupancy to key a plain rate write on, per room type.
 *
 * `defaultOccupancy` when the hotel has set one, the ceiling otherwise — which is the pre-OBP
 * meaning of every existing row and what the H1 migration backfilled them to.
 */
export async function occupancyKeysFor(
  db: OccupancyKeySource,
  roomTypeIds: readonly string[],
): Promise<Map<string, number>> {
  if (roomTypeIds.length === 0) return new Map();
  const rows = await db.roomType.findMany({
    where: { id: { in: [...new Set(roomTypeIds)] } },
    select: { id: true, maxGuests: true, defaultOccupancy: true },
  });
  return new Map(rows.map((r) => [r.id, r.defaultOccupancy ?? r.maxGuests]));
}

/** One room type. Convenience for the single-cell paths; never call this in a loop. */
export async function occupancyKeyFor(db: OccupancyKeySource, roomTypeId: string): Promise<number> {
  return (await occupancyKeysFor(db, [roomTypeId])).get(roomTypeId) ?? 1;
}
