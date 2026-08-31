/**
 * What the PMS bills for a night — PMS OBP §P3 / §P4.
 *
 * ## The rule that matters most: the PMS bills what was QUOTED
 *
 * The CRS quotes — live resolution at shop time. The PMS bills — the snapshot taken when the booking
 * was made. Those are different jobs and conflating them is the specific failure this exists to
 * prevent:
 *
 *   A guest is confirmed at €120. Somebody edits the occupancy table a fortnight later. The guest
 *   arrives and the folio, re-resolving live, bills €132 — disagreeing with the confirmation email
 *   they are holding and with the OTA's record of the same booking.
 *
 * That is a dispute at the desk, not a rounding difference. So a night's rate is locked to what was
 * quoted, and re-resolved **only** when something real changes: the occupancy, or the room type.
 * Never because a rate table moved.
 *
 * ## Precedence, highest first
 *
 *   1. **A manual per-stay override.** Somebody decided this specific stay costs this. It outranks
 *      everything, including the snapshot — that is what an override is for.
 *   2. **Comp / house use → 0.** Regardless of occupancy. A comped room is not a cheap room.
 *   3. **The snapshot** for that night, from booking or the last real change.
 *   4. **A live resolve**, only when no snapshot exists — a stay created before OBP, or an
 *      imported booking whose nights were never captured.
 *
 * Pure.
 */

export type NightRateSource = "override" | "comp" | "snapshot" | "resolved" | "none";

export interface NightRateInput {
  /** A manual price for this specific stay, in minor units. Outranks everything. */
  overrideMinor?: number | null;
  /** Comped or house-use — bills zero whatever the occupancy. */
  comp?: boolean;
  /** What this night was quoted at, if it was captured. */
  snapshotMinor?: number | null;
  /** A live resolve, used only when there is no snapshot. */
  resolvedMinor?: number | null;
}

export interface NightRate {
  minor: number | null;
  source: NightRateSource;
  /** One line for the folio, so a number that is not the plain rate says why. */
  note?: string;
}

export function nightRate(input: NightRateInput): NightRate {
  if (input.overrideMinor != null) {
    return { minor: input.overrideMinor, source: "override", note: "Price set for this stay" };
  }
  // Before the snapshot: a comped room bills nothing even though it was quoted something, and the
  // folio should say so rather than showing a bare zero somebody has to explain.
  if (input.comp) return { minor: 0, source: "comp", note: "Complimentary" };

  if (input.snapshotMinor != null) return { minor: input.snapshotMinor, source: "snapshot" };

  if (input.resolvedMinor != null) {
    // Reaching here means the stay has no snapshot — booked before OBP, or imported without nightly
    // rates. Resolving live is the right fallback and is worth flagging, because it is the one path
    // where the bill can move under the guest's feet.
    return { minor: input.resolvedMinor, source: "resolved", note: "Priced from the current rate" };
  }

  return { minor: null, source: "none" };
}

export interface StayNight {
  date: string;
  occupancy: number;
  minor: number | null;
  source: NightRateSource;
  note?: string;
}

/** Every night of a stay, and the total. `null` nights are excluded from the total and counted. */
export function stayTotal(nights: readonly StayNight[]): { totalMinor: number; unpriced: number } {
  let totalMinor = 0;
  let unpriced = 0;
  for (const n of nights) {
    if (n.minor == null) unpriced++;
    else totalMinor += n.minor;
  }
  return { totalMinor, unpriced };
}

/**
 * Which nights a change re-prices — §P6.
 *
 * **From the change forward, never backwards.** A guest who adds a second person on Thursday does not
 * owe the double rate for Monday: those nights were slept at one occupancy and have very likely been
 * posted already. Repricing them would be rewriting history and, on a folio the guest has seen, a
 * charge that appeared from nowhere.
 */
export function nightsToReprice(
  nights: readonly { date: string }[],
  changeDate: string,
): string[] {
  return nights.filter((n) => n.date >= changeDate).map((n) => n.date);
}

/** Why a night was re-resolved. Stored on the snapshot so a folio can explain a mid-stay change. */
export type RepriceReason = "booking" | "occupancy_change" | "room_move";

export function repriceNote(reason: RepriceReason, from: number, to: number): string | null {
  if (reason === "occupancy_change") {
    return `Repriced for ${to} guest${to === 1 ? "" : "s"} (was ${from})`;
  }
  if (reason === "room_move") return "Repriced for the new room type";
  return null;
}
