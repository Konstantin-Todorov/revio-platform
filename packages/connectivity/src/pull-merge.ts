/**
 * What to do with an incoming booking revision — the decision, separated from the database.
 *
 * This exists because of a bug that reached production. `pullChannel` handled an already-known
 * reservation by writing `{ status }` and nothing else, so every modification a guest actually makes
 * — new dates, an extra night, a different price — was discarded. The booking read "modified" while
 * still showing the original stay, and since availability is computed from reservation lines, the
 * extra night was never taken off the market.
 *
 * It survived because the logic was four lines buried in a function that needs a Postgres instance,
 * two mapping tables and a live Channex feed to execute. Nothing about the *decision* needs any of
 * that, so it lives here, pure, with the cases enumerated and tested. `pullChannel` keeps the part
 * that genuinely is I/O.
 */

export interface StayLine {
  roomTypeId: string;
  ratePlanId: string;
  quantity: number;
  /** YYYY-MM-DD. */
  checkIn: string;
  /** YYYY-MM-DD, exclusive. */
  checkOut: string;
  priceMinor?: number | null;
}

export interface Stay {
  /** Normalised: confirmed | modified | cancelled | overbooked | failed_import. */
  status: string;
  guestName: string;
  totalMinor: number;
  currency: string;
  lines: StayLine[];
}

export interface IncomingStay extends Stay {
  /** True when the revision references a room or rate this channel has no mapping for. */
  unmapped: boolean;
}

export type PullAction =
  /** No such reservation yet — import it. */
  | "create"
  /** Known reservation, and the revision genuinely differs — apply all of it. */
  | "update"
  /** Byte-for-byte the same as what we hold. Channex re-sends on a failed ack; this is that. */
  | "unchanged"
  /** Already cancelled. Terminal — never resurrect a room the hotel may have resold. */
  | "terminal-cancelled"
  /** Cannot be mapped. Flag it, but KEEP the stay we have rather than replacing it with nothing. */
  | "unmapped-hold";

/**
 * Everything a modification can change, in a comparable form.
 *
 * Lines are sorted, so the same stay arriving in a different order is correctly "unchanged" — Channex
 * gives no ordering guarantee, and treating a reshuffle as a modification would rewrite the
 * reservation (and re-run the overbooking check) on every re-delivery.
 */
export function stayFingerprint(stay: Stay): string {
  return [
    stay.guestName,
    stay.totalMinor,
    stay.currency,
    stay.status,
    ...stay.lines
      .map((l) => `${l.roomTypeId}|${l.ratePlanId}|${l.quantity}|${l.checkIn}|${l.checkOut}|${l.priceMinor ?? ""}`)
      .sort(),
  ].join("~");
}

/** The decision, in the order the rules take precedence. */
export function decidePull(existing: Stay | null, incoming: IncomingStay): PullAction {
  if (!existing) return "create";
  // Terminal before anything else: a late revision on a cancelled booking changes nothing.
  if (existing.status === "cancelled") return "terminal-cancelled";
  // Before the comparison, or an unmappable revision would look like "the stay became empty".
  if (incoming.unmapped || incoming.lines.length === 0) return "unmapped-hold";
  return stayFingerprint(existing) === stayFingerprint(incoming) ? "unchanged" : "update";
}
