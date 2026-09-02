/**
 * The main guest count — the party size a property's headline price is for.
 *
 * ## Why this is a property-level value
 *
 * "€80 for one, €100 for two" only means something once you know which of those is *the* price. The
 * main guest count is that anchor, and everything in occupancy pricing reads from it: the calendar
 * headline, the ladder rule ("each extra guest +€20" — above what?), the ADR the dashboard
 * reconciles to, and the occupancy Booking.com restrictions bind to.
 *
 * **It did not exist.** The bulk editor rendered a static label "2 guests", and the value behind it
 * was `roomTypes[0]?.defaultOccupancy ?? 2` — *the first room type in the list*. A property whose
 * first room happened to be a single was told its main guest count was 1; one with no default at all
 * was told 2 by a literal.
 *
 * ## Why it belongs in the shared core, not the CRS
 *
 * RevioLink is sold on its own. A property may have no CRS at all and still price per person, so the
 * anchor cannot live in a product one customer might not have bought.
 *
 * ## Why it is nullable, and derived when unset
 *
 * Making it required would mean inventing a value for every existing property at migration time and
 * having no way to tell a chosen 2 from a defaulted one. Unset means "nobody has said", which is a
 * real state a settings screen should be able to show and ask about.
 */

/** A property cannot sensibly anchor on more than this, and Channex will not carry more. */
export const MAX_MAIN_GUESTS = 30;

export type MainGuestBasis =
  /** Somebody chose it. */
  | "configured"
  /** Nobody has; taken from the rooms. */
  | "derived"
  /** Nobody has, and the rooms say nothing either. */
  | "fallback";

export interface MainGuestCount {
  value: number;
  basis: MainGuestBasis;
  /** Shown beside the number wherever it is used, so an assumption never reads as a decision. */
  note: string | null;
}

export interface RoomOccupancyFacts {
  /** The room's own standard occupancy, when it has one. */
  defaultOccupancy: number | null;
  /** Physical rooms of this type — used to weight the derivation toward the common room. */
  totalRooms: number;
  maxGuests: number;
}

/**
 * Resolve the main guest count for a property.
 *
 * When it has not been configured, the derivation is **the most common room's standard occupancy,
 * weighted by how many of that room there are** — not the first room in a list. A hotel with forty
 * doubles and one single anchors on two; the old code anchored on whichever row sorted first.
 */
export function resolveMainGuestCount(
  configured: number | null | undefined,
  rooms: readonly RoomOccupancyFacts[],
): MainGuestCount {
  if (configured != null && Number.isFinite(configured) && configured >= 1) {
    return { value: Math.min(Math.round(configured), MAX_MAIN_GUESTS), basis: "configured", note: null };
  }

  // Weight by physical room count: the anchor should describe the property's typical sale.
  const weights = new Map<number, number>();
  for (const r of rooms) {
    const occ = r.defaultOccupancy ?? r.maxGuests;
    if (!Number.isFinite(occ) || occ < 1) continue;
    const key = Math.min(Math.round(occ), MAX_MAIN_GUESTS);
    weights.set(key, (weights.get(key) ?? 0) + Math.max(1, r.totalRooms));
  }

  if (weights.size > 0) {
    // Ties break toward the SMALLER occupancy: under-anchoring makes the ladder add money, which is
    // visible and easy to correct. Over-anchoring makes it subtract, which quietly undersells.
    const best = [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
    return {
      value: best[0],
      basis: "derived",
      note: "Taken from your rooms — nobody has set this yet.",
    };
  }

  return {
    value: 2,
    basis: "fallback",
    note: "No rooms to work it out from — assuming 2 until you set it.",
  };
}

/** "2 guests — your main guest count". The label that replaces the hardcoded one. */
export function describeMainGuestCount(m: MainGuestCount): string {
  const guests = `${m.value} guest${m.value === 1 ? "" : "s"}`;
  return m.basis === "configured" ? `${guests} — your main guest count` : `${guests} — assumed`;
}
