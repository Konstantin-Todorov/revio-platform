/**
 * Which physical room should this booking go in?
 *
 * Every reservation is auto-assigned a room the moment it arrives, so the calendar can always draw
 * it and there is never an "unassigned" pile to work through (§2.3). That makes the choice a
 * scoring problem rather than a queue, and it is scored on something no channel manager or booking
 * engine can see: **what the choice costs housekeeping**.
 *
 * That is the differentiator, and it is only possible because assignment and housekeeping state
 * share one core. Among rooms that equally satisfy the booking and the guest, the cheapest room to
 * service wins — ready now, whole stay in one room, clustered with the floor's other turnovers,
 * load levelled across whoever is actually on shift.
 *
 * Pure. Every input is passed in — the caller reads the house, this decides.
 *
 * TWO RULES THAT OVERRIDE THE SCORE ENTIRELY:
 *  - A **pinned** assignment is never reconsidered. A human put the guest there, and the optimiser
 *    silently moving them the night before arrival is worse than any efficiency it could buy.
 *  - Candidates come only from the **booked room type**. An upgrade is a commercial decision a
 *    person makes, never something the system does to be helpful.
 */

export interface AssignmentCandidate {
  unitId: string;
  label: string;
  floor: string | null;
  /** `clean` / `inspected` are serviceable now; `dirty` needs a turn before arrival. */
  hkStatus: string;
  roomTypeId: string;
  /** True when the unit is free for EVERY night of the stay. A false here is disqualifying. */
  freeWholeStay: boolean;
  /** Free for some nights only — would force a mid-stay room move. */
  freeSomeNights: boolean;
  /** Out of order or blocked for any night of the stay. Disqualifying. */
  blocked: boolean;
}

export interface AssignmentContext {
  /** The room type the guest actually booked. Candidates outside it are not considered. */
  bookedRoomTypeId: string;
  /** Arrival is today — so the room has to be ready in hours, not days. */
  sameDayArrival: boolean;
  /**
   * The guest's preferred floor, and only when it is earned. The n≥2 rule: one previous stay is a
   * coincidence, not a preference, and acting on it produces confident nonsense.
   */
  preferredFloor: string | null;
  /** How many same-day turnovers each floor already has — clustering targets the busy ones. */
  turnoversByFloor: Record<string, number>;
  /** Floors with somebody clocked in. Empty means no roster, and load levelling is skipped. */
  staffedFloors: string[];
  /** How many stays each floor already holds tonight — used to concentrate, not spread. */
  occupiedByFloor: Record<string, number>;
}

export interface ScoredUnit {
  unitId: string;
  label: string;
  score: number;
  /** Why, in the order the reasons were applied. Shown to staff so the ranking can be trusted. */
  reasons: string[];
}

const SERVICEABLE = new Set(["clean", "inspected"]);

/**
 * Rank the candidates, best first. Disqualified units are dropped, not ranked low: a room that is
 * blocked or unavailable for part of the stay is not a worse choice, it is not a choice.
 */
export function rankUnitsForStay(
  candidates: AssignmentCandidate[],
  ctx: AssignmentContext,
): ScoredUnit[] {
  const eligible = candidates.filter(
    (c) => c.roomTypeId === ctx.bookedRoomTypeId && !c.blocked && c.freeWholeStay,
  );

  return eligible
    .map((c) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. The guest's own preference outranks every efficiency below it. A hotel that remembers
      //    which floor someone likes is worth more than one saved trip for a housekeeper.
      if (ctx.preferredFloor && c.floor === ctx.preferredFloor) {
        score += 1000;
        reasons.push("guest's usual floor");
      }

      // 2. Ready now beats needing a turn, and only really matters when the guest arrives today.
      //    Days out, a dirty room is not a problem — it is Tuesday.
      if (SERVICEABLE.has(c.hkStatus)) {
        score += ctx.sameDayArrival ? 300 : 40;
        if (ctx.sameDayArrival) reasons.push("ready now, no turn needed today");
      } else if (ctx.sameDayArrival) {
        reasons.push("needs cleaning before arrival");
      }

      // 3. Cluster today's turnovers. A housekeeper doing 205 · 207 · 209 walks a corridor; the same
      //    three rooms spread over three floors is the same work plus a day of stairs.
      const floorKey = c.floor ?? "";
      const turnovers = ctx.turnoversByFloor[floorKey] ?? 0;
      if (turnovers > 0) {
        score += Math.min(120, turnovers * 40);
        reasons.push(`clusters with ${turnovers} turnover${turnovers === 1 ? "" : "s"} on this floor`);
      }

      // 4. Concentrate occupancy so whole zones can be skipped. Spreading four guests over four
      //    floors means servicing four floors; putting them on one leaves three untouched — less
      //    walking, less linen moved, and the heating and lighting of an empty wing left off.
      const occupied = ctx.occupiedByFloor[floorKey] ?? 0;
      if (occupied > 0) {
        score += Math.min(80, occupied * 20);
        reasons.push("keeps occupancy together");
      }

      // 5. Level the load across whoever is actually on shift. Filling one staffed zone while
      //    another sits idle is efficient on paper and unfair in the building.
      if (ctx.staffedFloors.length > 0) {
        if (ctx.staffedFloors.includes(floorKey)) {
          score += 50;
          reasons.push("floor is staffed today");
        } else {
          score -= 60;
          reasons.push("no one clocked in on this floor");
        }
      }

      // 6. Anti-fragmentation tie-break. Prefer higher room numbers so the low, contiguous block
      //    stays open for a walk-in or a group that needs adjacent rooms. Deliberately small — it
      //    decides between equals and never outweighs a real reason.
      const num = Number.parseInt(c.label.replace(/\D/g, ""), 10);
      if (Number.isFinite(num)) score += Math.min(MAX_FRAGMENTATION_TIEBREAK, num / 100);

      if (reasons.length === 0) reasons.push("next available room");
      return { unitId: c.unitId, label: c.label, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/**
 * The most the anti-fragmentation tie-break can ever contribute.
 *
 * Named because a second decision depends on it: `REOPTIMISE_MIN_GAIN` has to sit above it, or the
 * optimiser would relocate a guest the night before arrival purely because one room number is
 * higher than another. The two numbers live in one file so that relationship can be tested rather
 * than remembered.
 */
export const MAX_FRAGMENTATION_TIEBREAK = 9;

/**
 * How much better a room must score before an unarrived guest is moved into it.
 *
 * Above the tie-break on purpose (see above): that nudge decides between rooms that are otherwise
 * equal and must never on its own be a reason to relocate anybody. Only a real operational gain — a
 * ready room instead of a dirty one, a clustered turnover, a staffed floor — clears this bar.
 *
 * The cost of moving is not zero even before arrival: somebody may already have written the room
 * number on a card at reception, and a calendar that reshuffles itself every night before every
 * arrival is one nobody trusts.
 */
export const REOPTIMISE_MIN_GAIN = 40;

/**
 * Is this improvement worth moving somebody for?
 *
 * Pure, so the judgement can be tested against the scoring weights it is calibrated to instead of
 * living as a bare `<` inside a database loop.
 */
export function worthReoptimising(currentScore: number, bestScore: number): boolean {
  // A non-finite score means the guest is in a room the scorer no longer rates at all — which is a
  // reason to look, not a licence to move on a comparison that cannot be made.
  if (!Number.isFinite(bestScore)) return false;
  if (!Number.isFinite(currentScore)) return true;
  return bestScore - currentScore >= REOPTIMISE_MIN_GAIN;
}

/** The single best room, or null when nothing in the booked type is free for the whole stay. */
export function suggestAssignment(
  candidates: AssignmentCandidate[],
  ctx: AssignmentContext,
): ScoredUnit | null {
  return rankUnitsForStay(candidates, ctx)[0] ?? null;
}

/**
 * Should the optimiser be allowed to move this reservation?
 *
 * Auto-assignments stay fluid until arrival, because the house keeps changing under them —
 * cancellations, new bookings, a room going out of order. A **manual** assignment is frozen the
 * moment it is made, permanently, including during the final pre-arrival pass. Somebody decided
 * that guest goes in that room, and the system does not get a vote afterwards.
 */
export function canReassign(assignment: { pinned: boolean; checkedInAt: Date | null }): boolean {
  if (assignment.pinned) return false;
  // Once the guest is in the room, moving them is a room move with a physical key and a suitcase,
  // not an optimisation.
  return assignment.checkedInAt == null;
}
