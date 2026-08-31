/**
 * Who owns a rate, and what happens when two products disagree — RevioLink L1.
 *
 * Founder-signed-off 2026-08-24; the reasoning is in `docs/SPEC-08-DECISIONS.md` and is repeated
 * here because this governs **every** rate, not only occupancy ones.
 *
 * ## The model is single-owned, not conflict-resolved
 *
 * A rate VALUE conflict is recoverable: the CRS reasserts a number and the worst case is a stale
 * price for one sync cycle. A pricing MODEL mismatch is structural — if the CRS prices per person
 * and Link flips to per-room, the occupancy rows stop existing. The ARI data is not stale, it is
 * **incoherent**, and there is nothing to reassert because the shape the values lived in has gone.
 *
 * So when a CRS is connected the model is read-only in Link, with a note saying who owns it. Not
 * "the CRS wins on conflict" — the conflict is never allowed to exist.
 *
 * ## Rate values ARE editable in Link, and revert visibly
 *
 * Blocking them would make Link useless for the hotels that live in it. Instead an edit applies
 * immediately, and the CRS's next authoritative push overwrites any diverging cell. Three
 * requirements, and the third is the one most easily forgotten:
 *
 *   1. The override is written to a visible log — the user sees WHY their value changed. Never a
 *      silent revert.
 *   2. Edit-time copy says it may not last.
 *   3. **The reassertion must re-push to the channels.** Otherwise the CRS and Link agree while the
 *      OTA is still selling the old Link value — the same parity failure, reached from the other
 *      direction.
 *
 * Pure.
 */

export type ConnectionState = "crs_linked" | "standalone";

export interface RateAuthority {
  /** Can this product change the pricing MODEL (per-room / per-person)? */
  canEditModel: boolean;
  /** Can it change rate VALUES? */
  canEditValues: boolean;
  /** Will an edit here be overwritten by an authoritative push? */
  transient: boolean;
  /** Shown beside a disabled control, or above an editable one. */
  note: string | null;
}

/** What RevioLink may do, given whether a CRS is driving it. */
export function linkAuthority(state: ConnectionState): RateAuthority {
  if (state === "standalone") {
    // Nobody upstream. Link owns everything outright, and nothing it writes gets reverted.
    return { canEditModel: true, canEditValues: true, transient: false, note: null };
  }
  return {
    canEditModel: false,
    canEditValues: true,
    transient: true,
    note: "Managed by your reservations system — changes here may be replaced on the next sync.",
  };
}

/** What the CRS may do. It is the author when it is connected, which is whenever it exists. */
export function crsAuthority(): RateAuthority {
  return { canEditModel: true, canEditValues: true, transient: false, note: null };
}

export interface Divergence {
  roomTypeId: string;
  ratePlanId: string;
  date: string;
  occupancy: number;
  linkMinor: number;
  crsMinor: number;
}

/**
 * Which Link edits the CRS is about to overwrite.
 *
 * Computed BEFORE the push so the notice can name them. Discovering afterwards that a value changed,
 * with no record of what it was, is the thing that makes a transient edit feel like a bug rather
 * than a rule.
 */
export function findDivergences(
  linkValues: readonly { roomTypeId: string; ratePlanId: string; date: string; occupancy: number; minor: number }[],
  crsValue: (roomTypeId: string, ratePlanId: string, date: string, occupancy: number) => number | null,
): Divergence[] {
  const out: Divergence[] = [];
  for (const v of linkValues) {
    const crsMinor = crsValue(v.roomTypeId, v.ratePlanId, v.date, v.occupancy);
    if (crsMinor == null || crsMinor === v.minor) continue;
    out.push({ ...v, linkMinor: v.minor, crsMinor });
  }
  return out;
}

/** The line written to the log when a value is reasserted. Says what, from what, and why. */
export function divergenceNote(d: Divergence, currency = "€"): string {
  return (
    `${d.date} · ${d.occupancy}p — changed here to ${currency}${(d.linkMinor / 100).toFixed(2)}, ` +
    `replaced with ${currency}${(d.crsMinor / 100).toFixed(2)} from your reservations system, which owns this rate.`
  );
}

/**
 * Does reasserting these values require a channel push?
 *
 * **Yes, whenever anything diverged**, and this is requirement 3 above. Correcting the database and
 * stopping there leaves the CRS and Link agreeing while the OTA still sells the Link value — the
 * parity failure reached from the other direction, and the harder one to spot because both internal
 * screens look right.
 */
export function reassertionNeedsPush(divergences: readonly Divergence[]): boolean {
  return divergences.length > 0;
}
