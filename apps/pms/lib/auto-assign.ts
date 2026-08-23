import "server-only";
import { forTenant, withTenantTransaction } from "@revio/db";
import { rankUnitsForStay, canReassign, type AssignmentCandidate } from "@revio/core";
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
    db.propertyDefaults.findUnique({ where: { propertyId }, select: { inspectionGate: true } }),
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
  const sellable = new Set(sellableStatuses(defs?.inspectionGate ?? false));

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

/** Sweep every property. The scheduled entry point; see `app/api/jobs/assign/route.ts`. */
export async function autoAssignAllProperties(
  db: ReturnType<typeof forTenant>,
): Promise<{ properties: number; assigned: number; unplaceable: number; details: string[] }> {
  const properties = await db.property.findMany({
    select: { id: true, tenantId: true, name: true, timezone: true },
  });
  let assigned = 0;
  let unplaceable = 0;
  const details: string[] = [];
  for (const p of properties) {
    const r = await autoAssignForProperty(p.tenantId, p.id, p.timezone);
    assigned += r.assigned;
    unplaceable += r.unplaceable;
    for (const d of r.details) details.push(`${p.name}: ${d}`);
  }
  return { properties: properties.length, assigned, unplaceable, details };
}
