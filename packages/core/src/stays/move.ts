/**
 * Moving a guest from one room to another (§2.5).
 *
 * Two different events wear the same gesture, and conflating them is how a hotel loses money or
 * annoys a guest:
 *
 *  - **Same room type** (101 → 105, both Deluxe Double): a purely operational move. Nothing about
 *    what was sold changes, so there is nothing to price. Check it is safe, commit, log.
 *  - **Across room types** (Standard → Deluxe, or the reverse): the guest is being accommodated in
 *    something other than what they bought. That has a price consequence, and a human decides what
 *    to do about it — never the system.
 *
 * The rule that governs the second case, and the reason this file is careful:
 *
 * > The reservation's room type **does not change**. The guest booked a Standard Double; that is
 * > the commercial truth and it stays in the CRS. The PMS records that they were *accommodated*
 * > somewhere else. One record, two facts (§2.7).
 *
 * So a front-desk upgrade is not a distribution event: no ARI update, no reservation-modification
 * message, nothing outbound. The physical room's occupancy changes — which the availability
 * waterfall reads — and the commercial record does not.
 *
 * Pure. The caller reads rates and writes rows; this decides what kind of move it is and what the
 * money question is.
 */

export interface MoveNight {
  /** `YYYY-MM-DD`. */
  date: string;
  /** What the guest is paying for this night, minor units, from the reservation line. */
  bookedMinor: number;
  /** What the destination room type costs this night, minor units, from the CRS rate. */
  destinationMinor: number;
}

export interface MoveAssessment {
  kind: "operational" | "rate_affecting";
  /** Nights actually re-priced. An arrival-day move re-rates the whole stay; a mid-stay move only
   *  the nights not yet slept. Stated so the prompt can say which. */
  nights: string[];
  /** destination − booked, summed over the affected nights. Positive = upgrade, negative = down. */
  differenceMinor: number;
  direction: "upgrade" | "downgrade" | "even";
  /** What the manager is being asked to choose between. Empty for an operational move. */
  options: MoveResolution[];
}

/**
 * `comp` and `waive` both mean "no money changes hands", and they are deliberately separate: one is
 * a gift the hotel chose to give, the other is a debt the hotel chose not to collect. Reporting
 * them as the same thing loses the distinction an owner most wants.
 */
export type MoveResolution = "comp" | "charge" | "refund" | "waive" | "custom";

export interface AssessMoveInput {
  bookedRoomTypeId: string;
  destinationRoomTypeId: string;
  /** Every night of the stay, in order. */
  stayNights: MoveNight[];
  /** `YYYY-MM-DD` the move takes effect. Nights before it are already slept and are not re-priced. */
  effectiveFrom: string;
}

export function assessMove(input: AssessMoveInput): MoveAssessment {
  const { bookedRoomTypeId, destinationRoomTypeId, stayNights, effectiveFrom } = input;

  // Nights already slept are not re-priced. The guest stayed in the old room those nights and was
  // correctly charged for it; re-rating them retroactively would rewrite history to match a
  // decision taken afterwards. This is also what makes a mid-stay move interact correctly with a
  // folio split by night: nights in room A at rate A, nights in room B at rate B.
  const affected = stayNights.filter((n) => n.date >= effectiveFrom);

  if (bookedRoomTypeId === destinationRoomTypeId) {
    return {
      kind: "operational",
      nights: affected.map((n) => n.date),
      differenceMinor: 0,
      direction: "even",
      options: [],
    };
  }

  const differenceMinor = affected.reduce((s, n) => s + (n.destinationMinor - n.bookedMinor), 0);
  const direction = differenceMinor > 0 ? "upgrade" : differenceMinor < 0 ? "downgrade" : "even";

  // Which resolutions make sense depends on which way the money points. Offering "refund" on an
  // upgrade, or "charge" on a downgrade, is how a tired receptionist at 23:00 picks the wrong one.
  const options: MoveResolution[] =
    direction === "upgrade"
      ? ["comp", "charge", "custom"]
      : direction === "downgrade"
        ? ["refund", "waive", "custom"]
        : [];

  return { kind: "rate_affecting", nights: affected.map((n) => n.date), differenceMinor, direction, options };
}

/**
 * The line to write on the reservation's history, in plain content a person can read years later.
 *
 * Deliberately spells out BOTH facts. "Upgraded to a Deluxe" loses what was sold; "Standard Double"
 * alone loses where they actually slept. A dispute months later needs both, and so does anyone
 * asking why the invoice and the room number disagree.
 */
export function describeAccommodation(input: {
  bookedRoomTypeName: string;
  bookedUnitLabel: string | null;
  accommodatedRoomTypeName: string;
  accommodatedUnitLabel: string;
}): string {
  const from = input.bookedUnitLabel ? `room ${input.bookedUnitLabel}` : "room —";
  return (
    `Original room type booked: ${input.bookedRoomTypeName} (${from}). ` +
    `Accommodated in: ${input.accommodatedRoomTypeName}, room ${input.accommodatedUnitLabel}.`
  );
}

/**
 * Does this move need to tell anybody outside the hotel? No. Ever.
 *
 * Stated as a function rather than a comment because it is the rule most likely to be "fixed" by
 * someone reasoning that a changed room ought to be pushed somewhere. The CRS sold a Standard and
 * decremented Standard availability; the guest is walked into an empty Deluxe. The PMS updates the
 * physical room's occupancy — which the waterfall reads, so the Deluxe correctly shows as occupied
 * — and emits NOTHING to channels. Two ways to get this wrong, and both are bugs: pushing an update
 * that should not exist, or failing to show the Deluxe as occupied.
 */
export function moveRequiresDistributionPush(): false {
  return false;
}
