/**
 * Is this stay in the house, and is it overdue?
 *
 * Pure, because getting it wrong is expensive and was: both questions used to be answered inline by
 * folding over assignment rows, in three different files that agreed by coincidence. A stay that had
 * been checked out and then checked in again had a live assignment row, so every one of those folds
 * called it in-house — and it overstayed one more night every night while the audit charged it for a
 * room and a breakfast it was not using.
 *
 * The rule the round settled on, in one place:
 *   - `departedAt` is authoritative. If the stay has departed it is not in the house, whatever any
 *     assignment row says, and a departed stay can never overstay.
 *   - Otherwise a stay is in the house when it holds at least one live assignment.
 *   - Overstaying means past the departure date and still in the house. It is a data-integrity
 *     problem, not a late checkout.
 *   - Past the checkout time on the day of departure is the gentle version: a nudge, not a fault.
 */

/** The parts of a room assignment that decide occupancy. Anything else is presentation. */
export interface StayAssignment {
  /** `active` while the assignment stands; `moved` once superseded by a room move. */
  status: string;
  /** Set when the guest left this room. */
  checkedOutAt: Date | null;
}

export interface StayStateInput {
  /** When the stay ended, if it has. Authoritative over the assignment rows. */
  departedAt: Date | null;
  assignments: StayAssignment[];
  /** Departure date of the stay, `YYYY-MM-DD` in the property's timezone. */
  checkOutDate: string;
  /** Today in the property's timezone, `YYYY-MM-DD`. */
  today: string;
  /** Minutes past midnight, now, in the property's timezone. */
  nowMinutes: number;
  /** The property's checkout time in minutes past midnight. */
  checkOutMinutes: number;
}

/**
 * `overstayed` — past the departure date and never checked out. Distorts occupancy and keeps the
 *   accrual clock running; the front desk shows it as an exception because it is one.
 * `past_time` — due out today, clock is past checkout. Ordinary, and worth a nudge.
 */
export type OverdueState = "past_time" | "overstayed" | null;

export interface StayState {
  inHouse: boolean;
  departed: boolean;
  overdueState: OverdueState;
  /** Nights overstayed, or 0. Separate from minutes so a caller never has to divide by 1440. */
  overstayedNights: number;
  /** Minutes past the checkout deadline for `past_time`, else 0. */
  pastTimeMinutes: number;
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` precedes `from`. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function deriveStayState(input: StayStateInput): StayState {
  const { departedAt, assignments, checkOutDate, today, nowMinutes, checkOutMinutes } = input;

  const departed = departedAt != null;
  const liveAssignments = assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
  const inHouse = !departed && liveAssignments.length > 0;

  if (!inHouse) {
    return { inHouse: false, departed, overdueState: null, overstayedNights: 0, pastTimeMinutes: 0 };
  }

  if (checkOutDate < today) {
    return {
      inHouse: true,
      departed: false,
      overdueState: "overstayed",
      overstayedNights: daysBetween(checkOutDate, today),
      pastTimeMinutes: 0,
    };
  }

  if (checkOutDate === today && nowMinutes > checkOutMinutes) {
    return {
      inHouse: true,
      departed: false,
      overdueState: "past_time",
      overstayedNights: 0,
      pastTimeMinutes: nowMinutes - checkOutMinutes,
    };
  }

  return { inHouse: true, departed: false, overdueState: null, overstayedNights: 0, pastTimeMinutes: 0 };
}

/**
 * May this reservation be checked in?
 *
 * A departed stay may not: re-checking one in is what created the deadlocked record this round
 * exists to fix. The way back is a manager reopening the stay, not a second check-in — a returning
 * guest is a new reservation.
 */
export function canCheckIn(input: { departedAt: Date | null }): { allowed: boolean; reason?: string } {
  if (input.departedAt) {
    return { allowed: false, reason: "departed" };
  }
  return { allowed: true };
}

/**
 * May this reservation be cancelled?
 *
 * Not while the guest is in the house. Cancelling restores availability, and the PMS holds a
 * separate physical record of who is in which room — so cancelling an occupied stay put the room
 * back on sale with somebody in it, which is the double-booking the platform exists to prevent,
 * reached from the inside. Production carried exactly that: a cancelled reservation sitting in the
 * front desk's live-bills list at €393, still holding room 110.
 *
 * A guest who has arrived and is leaving early is a **check-out**, not a cancellation. That path
 * settles the folio, releases the room and marks it for cleaning; cancellation does none of it.
 *
 * This governs what WE initiate. A cancellation arriving from an OTA is a fact about the outside
 * world and cannot be refused — it has to be accepted and made visible instead.
 */
export function canCancel(input: {
  assignments: StayAssignment[];
  departedAt: Date | null;
}): { allowed: boolean; reason?: string } {
  if (input.departedAt) return { allowed: false, reason: "departed" };
  const occupied = input.assignments.some((a) => a.status === "active" && a.checkedOutAt == null);
  if (occupied) return { allowed: false, reason: "in_house" };
  return { allowed: true };
}
