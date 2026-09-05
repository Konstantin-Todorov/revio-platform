import "server-only";
import { forTenant, withTenantTransaction } from "@revio/db";
import {
  rankUnitsForStay,
  canReassign,
  worthReoptimising,
  type AssignmentCandidate,
} from "@revio/core";
import { ymd, todayInTz, utcDay } from "./format";
import { sellableStatuses, type HkStatus } from "./hk-meta";

/**
 * Give every reservation a room, so there is never an unassigned pile (§2.3).
 *
 * The calendar draws assignments. That is only safe if every booking has one, which is why the spec
 * removes the unassigned state entirely rather than adding a row for it: a booking nobody has
 * placed is a booking nobody can see, and the screen that is supposed to answer "what is happening
 * on Friday" would quietly be answering "what is happening on Friday, among the ones somebody
 * remembered to check in".
 *
 * Placements are PROVISIONAL until arrival. The house keeps changing under them — cancellations,
 * new bookings, a room going out of order — so an unpinned assignment is re-examined on each run
 * and may move. A **pinned** one never is (`canReassign`): a person chose that room.
 *
 * Idempotent and safe to run often. Every placement re-checks, inside its own transaction, that the
 * room is still free — two runs racing, or a human checking someone in mid-sweep, must not be able
 * to put two guests behind one door.
 */

/** Statuses that deserve a room. A cancelled or no-show booking is not going to arrive. */
const ASSIGNABLE = ["confirmed", "modified", "overbooked"];

/**
 * How far ahead to place bookings. Far enough that the calendar is useful for planning, near enough
 * that we are not solving next spring's puzzle with today's information — it would be re-solved
 * many times before it mattered, and every solve is writes.
 */
const HORIZON_DAYS = 60;

export interface AutoAssignResult {
  assigned: number;
  reassigned: number;
  unplaceable: number;
  details: string[];
}

export async function autoAssignForProperty(
  tenantId: string,
  propertyId: string,
  timezone: string,
): Promise<AutoAssignResult> {
  const db = forTenant(tenantId);
  const today = todayInTz(timezone);
  const horizonEnd = new Date(Date.parse(`${today}T00:00:00Z`) + HORIZON_DAYS * 86_400_000);

  const [defs, units, reservations] = await Promise.all([
    db.propertyDefaults.findUnique({ where: { propertyId }, select: { inspectionGate: true, autoAssignEnabled: true } }),
    db.unit.findMany({
      where: { propertyId, active: true },
      select: { id: true, label: true, floor: true, hkStatus: true, roomTypeId: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    db.reservation.findMany({
      where: {
        propertyId,
        status: { in: ASSIGNABLE },
        departedAt: null,
        lines: { some: { checkOut: { gt: utcDay(today) }, checkIn: { lt: horizonEnd } } },
      },
      include: {
        lines: true,
        guest: { select: { id: true } },
        assignments: { where: { status: "active", checkedOutAt: null } },
      },
    }),
  ]);

  if (units.length === 0) return { assigned: 0, reassigned: 0, unplaceable: 0, details: [] };

  // OPT-IN per property (§2.4 guardrail, and the Configuration screen already promises it).
  // A hotel that assigns rooms by hand on a whiteboard must not find the software has quietly
  // decided for them overnight — and the flag existed on the settings screen before this job did,
  // so ignoring it would have made that screen lie.
  if (!defs?.autoAssignEnabled) return { assigned: 0, reassigned: 0, unplaceable: 0, details: [] };

  const sellable = new Set(sellableStatuses(defs.inspectionGate ?? false));

  // Every live assignment in the horizon, so occupancy can be answered without a query per candidate.
  const occupied = await db.roomAssignment.findMany({
    where: {
      propertyId, status: "active", checkedOutAt: null,
      checkIn: { lt: horizonEnd },
    },
    select: { id: true, unitId: true, checkIn: true, checkOut: true },
  });

  const result: AutoAssignResult = { assigned: 0, reassigned: 0, unplaceable: 0, details: [] };

  for (const r of reservations) {
    const line = r.lines[0];
    if (!line) continue;

    const existing = r.assignments[0];
    if (existing) {
      // Already placed. Only an UNPINNED, not-yet-arrived assignment may be reconsidered, and this
      // pass deliberately does not move it: re-optimisation is a separate decision with its own
      // rules (§2.3's 0-12h window), and shuffling rooms on every sweep would be churn, not value.
      if (!canReassign({ pinned: existing.pinned, checkedInAt: existing.checkedInAt })) continue;
      continue;
    }

    const stayFrom = ymd(line.checkIn);
    const stayTo = ymd(line.checkOut);

    const candidates: AssignmentCandidate[] = units.map((u) => {
      const clash = occupied.some(
        (o) => o.unitId === u.id && o.checkIn < line.checkOut && o.checkOut > line.checkIn,
      );
      return {
        unitId: u.id,
        label: u.label,
        floor: u.floor,
        hkStatus: u.hkStatus,
        roomTypeId: u.roomTypeId,
        freeWholeStay: !clash,
        freeSomeNights: false,
        blocked: u.hkStatus === "out_of_order" || !sellable.has(u.hkStatus as HkStatus),
      };
    });

    const ranked = rankUnitsForStay(candidates, {
      bookedRoomTypeId: line.roomTypeId,
      sameDayArrival: stayFrom === today,
      // The n>=2 rule lives with the caller: a preference is only passed once it is earned, and this
      // sweep does not have the stay history to earn it. Left null rather than guessed.
      preferredFloor: null,
      turnoversByFloor: turnoversByFloor(occupied, units, today),
      staffedFloors: [],
      occupiedByFloor: occupiedByFloor(occupied, units, stayFrom),
    });

    if (ranked.length === 0) {
      result.unplaceable++;
      // Not an error and not silent: an overbooked date or a house genuinely full is a real
      // operational fact the front desk needs, and inventing a room for it would be worse.
      result.details.push(`${r.guestName}: no free ${stayFrom}→${stayTo} in the booked room type`);
      continue;
    }

    const choice = ranked[0]!;

    // The claim, re-checked inside its own transaction. The scan above is a snapshot; between it and
    // this write another sweep, a check-in or a room move may have taken the room. Checking here is
    // the difference between a fast placement and two guests behind one door.
    const placed = await withTenantTransaction(tenantId, async (tx) => {
      const taken = await tx.roomAssignment.count({
        where: {
          unitId: choice.unitId, status: "active", checkedOutAt: null,
          checkIn: { lt: line.checkOut }, checkOut: { gt: line.checkIn },
        },
      });
      if (taken > 0) return false;
      const stillUnassigned = await tx.roomAssignment.count({
        where: { reservationId: r.id, status: "active", checkedOutAt: null },
      });
      if (stillUnassigned > 0) return false; // somebody placed it while we were deciding

      await tx.roomAssignment.create({
        data: {
          tenantId, propertyId, reservationId: r.id, reservationLineId: line.id,
          unitId: choice.unitId, checkIn: line.checkIn, checkOut: line.checkOut,
          status: "active",
          // NOT checked in. A room is allocated; the guest has not arrived. Conflating the two is
          // what would put a future booking into tonight's occupancy and the night audit's revenue.
          checkedInAt: null,
          pinned: false,
          note: `auto-assigned · ${choice.reasons[0]}`,
        },
      });
      return true;
    });

    if (placed) {
      result.assigned++;
      occupied.push({ id: "pending", unitId: choice.unitId, checkIn: line.checkIn, checkOut: line.checkOut });
      result.details.push(`${r.guestName} → ${choice.label} (${choice.reasons[0]})`);
    }
  }

  return result;
}

/** Same-day turnovers per floor: rooms a guest leaves today, which somebody has to clean today. */
function turnoversByFloor(
  occupied: { unitId: string; checkOut: Date }[],
  units: { id: string; floor: string | null }[],
  today: string,
): Record<string, number> {
  const floorOf = new Map(units.map((u) => [u.id, u.floor ?? ""]));
  const out: Record<string, number> = {};
  for (const o of occupied) {
    if (ymd(o.checkOut) !== today) continue;
    const f = floorOf.get(o.unitId) ?? "";
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}

/** Stays per floor on the arrival night — the input to "concentrate, don't spread". */
function occupiedByFloor(
  occupied: { unitId: string; checkIn: Date; checkOut: Date }[],
  units: { id: string; floor: string | null }[],
  onDate: string,
): Record<string, number> {
  const floorOf = new Map(units.map((u) => [u.id, u.floor ?? ""]));
  const d = Date.parse(`${onDate}T00:00:00Z`);
  const out: Record<string, number> = {};
  for (const o of occupied) {
    if (!(o.checkIn.getTime() <= d && d < o.checkOut.getTime())) continue;
    const f = floorOf.get(o.unitId) ?? "";
    out[f] = (out[f] ?? 0) + 1;
  }
  return out;
}

/**
 * The decisive pre-arrival pass (§2.3).
 *
 * Earlier placements are provisional and were made with incomplete information: bookings and
 * cancellations were still moving, and nobody knew what housekeeping's day would look like. In the
 * hours before arrival that uncertainty has largely resolved — where every other guest will actually
 * be, which rooms are clean, what is out of order — so this is the last and best moment to decide
 * where a guest should go.
 *
 * The spec is explicit that this is "assign on the most accurate operational state, not just a
 * timer". The window is how we know the state is trustworthy; the re-scoring is the point.
 *
 * THREE THINGS IT WILL NOT DO:
 *  - touch a **pinned** assignment (`canReassign`) — a person chose that room;
 *  - touch a guest who has **arrived** — that is a room move with a key and a suitcase, not an
 *    optimisation, and it belongs to the front desk;
 *  - move anyone for a **marginal** gain. A room that scores a fraction better is not worth changing
 *    the answer somebody may already have written on a card at reception, and churn would make the
 *    calendar untrustworthy the night before every arrival.
 */

/** Arrivals within this many hours are close enough that the house's picture is reliable. */
const REOPTIMISE_WINDOW_HOURS = 12;

/*
 * How much better a room must score before anybody is moved now lives in `@revio/core` beside the
 * scoring weights it is calibrated against — `REOPTIMISE_MIN_GAIN`, and `worthReoptimising` which
 * applies it. It was a bare constant here and a `<` comparison in the loop below, one file away from
 * the tie-break bound it has to exceed. A test now pins that relationship instead of a comment
 * asserting it.
 */

export async function reoptimiseImminentArrivals(
  tenantId: string,
  propertyId: string,
  timezone: string,
): Promise<{ moved: number; considered: number; details: string[] }> {
  const db = forTenant(tenantId);
  const today = todayInTz(timezone);

  const defs = await db.propertyDefaults.findUnique({
    where: { propertyId },
    select: { inspectionGate: true, autoAssignEnabled: true },
  });
  if (!defs?.autoAssignEnabled) return { moved: 0, considered: 0, details: [] };
  const sellable = new Set(sellableStatuses(defs.inspectionGate ?? false));

  const now = Date.now();
  const windowEnd = new Date(now + REOPTIMISE_WINDOW_HOURS * 3_600_000);

  const candidatesToReview = await db.roomAssignment.findMany({
    where: {
      propertyId,
      status: "active",
      checkedOutAt: null,
      checkedInAt: null, // not arrived — see the second rule above
      pinned: false, // not chosen by a person — see the first
      checkIn: { lte: windowEnd },
      reservation: { departedAt: null, status: { in: ASSIGNABLE } },
    },
    include: {
      unit: { select: { id: true, label: true, floor: true, roomTypeId: true, hkStatus: true } },
      line: { select: { id: true, roomTypeId: true, checkIn: true, checkOut: true } },
      reservation: { select: { id: true, guestName: true } },
    },
  });
  if (candidatesToReview.length === 0) return { moved: 0, considered: 0, details: [] };

  const units = await db.unit.findMany({
    where: { propertyId, active: true },
    select: { id: true, label: true, floor: true, hkStatus: true, roomTypeId: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const occupied = await db.roomAssignment.findMany({
    where: { propertyId, status: "active", checkedOutAt: null },
    select: { id: true, unitId: true, checkIn: true, checkOut: true },
  });

  let moved = 0;
  const details: string[] = [];

  for (const a of candidatesToReview) {
    const line = a.line;

    const scored = rankUnitsForStay(
      units.map((u) => ({
        unitId: u.id,
        label: u.label,
        floor: u.floor,
        hkStatus: u.hkStatus,
        roomTypeId: u.roomTypeId,
        // The room the guest is already in does not clash with itself.
        freeWholeStay: !occupied.some(
          (o) => o.unitId === u.id && o.id !== a.id && o.checkIn < line.checkOut && o.checkOut > line.checkIn,
        ),
        freeSomeNights: false,
        blocked: u.hkStatus === "out_of_order" || !sellable.has(u.hkStatus as HkStatus),
      })),
      {
        bookedRoomTypeId: line.roomTypeId,
        sameDayArrival: ymd(line.checkIn) === today,
        preferredFloor: null,
        turnoversByFloor: turnoversByFloor(occupied, units, today),
        staffedFloors: await staffedFloorsNow(db, propertyId, units),
        occupiedByFloor: occupiedByFloor(occupied, units, ymd(line.checkIn)),
      },
    );

    const best = scored[0];
    if (!best || best.unitId === a.unitId) continue;
    const currentScore = scored.find((s) => s.unitId === a.unitId)?.score ?? -Infinity;
    if (!worthReoptimising(currentScore, best.score)) continue;

    // Same claim-inside-a-transaction discipline as the first placement: the scan is a snapshot, and
    // a check-in or another sweep may have taken the room since.
    const done = await withTenantTransaction(tenantId, async (tx) => {
      const taken = await tx.roomAssignment.count({
        where: {
          unitId: best.unitId, status: "active", checkedOutAt: null,
          checkIn: { lt: line.checkOut }, checkOut: { gt: line.checkIn },
        },
      });
      if (taken > 0) return false;
      // Re-read the row: if somebody pinned it or checked the guest in while we were scoring, the
      // two rules above now forbid what we were about to do.
      const fresh = await tx.roomAssignment.findUnique({
        where: { id: a.id },
        select: { pinned: true, checkedInAt: true, status: true, checkedOutAt: true },
      });
      if (!fresh || fresh.status !== "active" || fresh.checkedOutAt) return false;
      if (!canReassign({ pinned: fresh.pinned, checkedInAt: fresh.checkedInAt })) return false;

      await tx.roomAssignment.update({ where: { id: a.id }, data: { status: "moved" } });
      await tx.roomAssignment.create({
        data: {
          tenantId, propertyId, reservationId: a.reservation.id, reservationLineId: line.id,
          unitId: best.unitId, checkIn: line.checkIn, checkOut: line.checkOut,
          status: "active", checkedInAt: null, pinned: false,
          note: `re-optimised before arrival · ${best.reasons[0]}`,
        },
      });
      return true;
    });

    if (done) {
      moved++;
      const idx = occupied.findIndex((o) => o.id === a.id);
      if (idx >= 0) occupied.splice(idx, 1);
      occupied.push({ id: "reopt", unitId: best.unitId, checkIn: line.checkIn, checkOut: line.checkOut });
      details.push(`${a.reservation.guestName}: ${a.unit.label} → ${best.label} (${best.reasons[0]})`);
    }
  }

  return { moved, considered: candidatesToReview.length, details };
}

/** Floors with somebody clocked in right now — the input to levelling housekeeping's load. */
async function staffedFloorsNow(
  db: ReturnType<typeof forTenant>,
  propertyId: string,
  units: { id: string; floor: string | null }[],
): Promise<string[]> {
  const open = await db.staffShift.findMany({
    where: { propertyId, clockOutAt: null },
    select: { userId: true },
  });
  if (open.length === 0) return [];
  // Without per-shift zones there is no floor to attribute a shift to, so rather than invent one,
  // report every floor that has rooms as staffed: the effect is that levelling stops discriminating
  // between floors, which is the honest answer when nobody has told us who is working where.
  return [...new Set(units.map((u) => u.floor ?? ""))];
}

/** Sweep every property. The scheduled entry point; see `app/api/jobs/assign/route.ts`. */
export async function autoAssignAllProperties(
  db: ReturnType<typeof forTenant>,
): Promise<{ properties: number; assigned: number; reoptimised: number; unplaceable: number; details: string[] }> {
  const properties = await db.property.findMany({
    select: { id: true, tenantId: true, name: true, timezone: true },
  });
  let assigned = 0;
  let unplaceable = 0;
  let reoptimised = 0;
  const details: string[] = [];
  for (const p of properties) {
    // Place first, then re-optimise. A booking that arrives unassigned an hour before check-in
    // should be placed by the same pass that would have improved it, not left for the next tick.
    const r = await autoAssignForProperty(p.tenantId, p.id, p.timezone);
    assigned += r.assigned;
    unplaceable += r.unplaceable;
    for (const d of r.details) details.push(`${p.name}: ${d}`);

    const o = await reoptimiseImminentArrivals(p.tenantId, p.id, p.timezone);
    reoptimised += o.moved;
    for (const d of o.details) details.push(`${p.name}: ${d}`);
  }
  return { properties: properties.length, assigned, reoptimised, unplaceable, details };
}
