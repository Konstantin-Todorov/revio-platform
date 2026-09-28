/**
 * What may happen to a room type and to the physical rooms under it — the rules every product
 * asks, so no product answers them its own way.
 *
 * ## Why these are shared
 *
 * A room type is ONE row that three products lean on: RevioLink sells it, RevioCRS books it,
 * RevioPMS hangs the physical doors off it. Each product used to decide on its own whether one could
 * be deleted, and they disagreed. RevioCRS refused when rooms stood behind it; RevioLink did not, and
 * a delete there cascaded every physical room, its housekeeping and its maintenance history out of
 * RevioPMS without a word — found 2026-09-28, walking a hotel that owns both.
 *
 * The same walk found the doors themselves unguarded: nothing stopped "101" being created twice, or
 * fifty rooms under a type sold as ten. A real hotel has four rooms called 101 and eleven more doors
 * than rooms. Both are refused here, in words that say what to do instead.
 */

/** What deleting a room type should do, from what already depends on it. */
export type RoomTypeRemoval =
  /** Nothing depends on it — remove it outright. */
  | "delete"
  /** Bookings or physical rooms stand behind it — switch it off so history and the board survive. */
  | "deactivate"
  /** A channel still sells it — unmap it first, or the OTA keeps selling a product we no longer have. */
  | "blocked_mapped";

export function roomTypeRemoval(uses: { mapped: number; reservations: number; units: number }): RoomTypeRemoval {
  if (uses.mapped > 0) return "blocked_mapped";
  if (uses.reservations > 0 || uses.units > 0) return "deactivate";
  return "delete";
}

/** A room number as a person means it: "101", " 101 " and "101" are one door. */
export function sameRoomLabel(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export type UnitPlan =
  | { ok: true; create: string[]; skipped: string[] }
  | { ok: false; reason: "all_exist"; skipped: string[] }
  /** `left` is how many more doors this type may still get. */
  | { ok: false; reason: "over_capacity"; left: number; skipped: string[] };

/**
 * Which of the wanted room numbers to create.
 *
 * - A number that already exists at the property is **skipped**, never duplicated — so running a
 *   floor twice is safe, and two doors can never answer to one number at the front desk.
 * - The rest must fit under the room type's count (`RoomType.totalRooms`, the number every channel
 *   sells). Over it, **nothing** is created: a partial run would leave the hotel guessing which
 *   rooms exist. The refusal says how many still fit.
 */
export function planUnits(args: {
  wanted: string[];
  /** Every room number already at the property, under any room type. */
  taken: string[];
  totalRooms: number;
  /** Doors already under THIS room type. */
  unitsOfType: number;
}): UnitPlan {
  const create: string[] = [];
  const skipped: string[] = [];
  for (const raw of args.wanted) {
    const label = raw.trim();
    if (!label) continue;
    if (args.taken.some((t) => sameRoomLabel(t, label)) || create.some((c) => sameRoomLabel(c, label))) skipped.push(label);
    else create.push(label);
  }
  if (create.length === 0) return { ok: false, reason: "all_exist", skipped };
  const left = Math.max(0, args.totalRooms - args.unitsOfType);
  if (create.length > left) return { ok: false, reason: "over_capacity", left, skipped };
  return { ok: true, create, skipped };
}
