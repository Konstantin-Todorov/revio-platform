import "server-only";
import { prisma } from "./db";
import { getSession } from "./session";
import { todayInTz, ymd, utcDay } from "./format";
import type { HkStatus } from "./hk-meta";

// Statuses that actually occupy a room tonight (front-desk view). Distinct from the metrics
// SOLD_STATUSES (which also counts no_show/overbooked) — an in-house guest is confirmed/modified.
// Check-in/out do NOT change this status (a checked-in guest is still a sold booking); the operational
// stay state lives on RoomAssignment (docs/PMS-REFERENCE.md).
const OCCUPYING = ["confirmed", "modified"] as const;

/** Resolve the active property from the session (throws if unauthenticated — protected routes only). */
export async function activeProperty() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  const property = await prisma.property.findUnique({ where: { id: session.activePropertyId } });
  if (!property) throw new Error("No active property");
  return { session, property };
}

export interface UnitRow {
  id: string;
  label: string;
  floor: string | null;
  hkStatus: HkStatus;
  active: boolean;
  roomTypeId: string;
  roomTypeName: string;
  occupied: boolean;
  guestName: string | null;
}

/** Room types (active) each with their physical units, for the Rooms setup screen. */
export async function getRoomsBoard() {
  const { property } = await activeProperty();
  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: { units: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });
  return { property, roomTypes };
}

/** Every unit (with room type + floor + live occupancy), for the housekeeping board. */
export async function getHousekeepingUnits(): Promise<{ property: Awaited<ReturnType<typeof activeProperty>>["property"]; units: UnitRow[] }> {
  const { property } = await activeProperty();
  const [units, occupied] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      include: { roomType: { select: { name: true } } },
    }),
    // In-house assignments (checked in, not out) → the unit is occupied now.
    prisma.roomAssignment.findMany({
      where: { propertyId: property.id, status: "active", checkedOutAt: null, checkedInAt: { not: null } },
      include: { reservation: { include: { guest: true } } },
    }),
  ]);
  const occByUnit = new Map(occupied.map((a) => [a.unitId, a.reservation]));
  return {
    property,
    units: units.map((u) => {
      const res = occByUnit.get(u.id);
      const guestName = res ? (res.guest ? `${res.guest.firstName} ${res.guest.lastName}`.trim() : res.guestName) : null;
      return {
        id: u.id,
        label: u.label,
        floor: u.floor,
        hkStatus: u.hkStatus as HkStatus,
        active: u.active,
        roomTypeId: u.roomTypeId,
        roomTypeName: u.roomType.name,
        occupied: !!res,
        guestName,
      };
    }),
  };
}

/** Housekeeping status counts across all active units. */
export function statusCounts(units: { hkStatus: HkStatus }[]): Record<HkStatus, number> {
  const base: Record<HkStatus, number> = { clean: 0, dirty: 0, inspected: 0, out_of_order: 0 };
  for (const u of units) base[u.hkStatus] = (base[u.hkStatus] ?? 0) + 1;
  return base;
}

function nightsBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

export interface StayRow {
  reservationId: string;
  guestName: string;
  roomLabel: string; // room type name, or "N rooms" for multi-line
  checkIn: string;
  checkOut: string;
  nights: number;
  status: string;
  assignedUnits: { assignmentId: string; unitId: string; unitLabel: string }[];
  dueOutToday: boolean;
  overdue: boolean; // arrival date already passed, still not checked in
}

/**
 * Assignment-aware front-desk overview (Phase 2): housekeeping counts + today's arrivals (to check in),
 * in-house guests (with their assigned room), and who departed today. Stay state is derived from
 * RoomAssignment (checkedInAt / checkedOutAt) — the reservation's sold status never changes.
 */
export async function getFrontDeskOverview() {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);

  const [units, reservations] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: property.id, active: true }, select: { hkStatus: true } }),
    prisma.reservation.findMany({
      where: { propertyId: property.id, status: { in: [...OCCUPYING] } },
      include: {
        lines: { include: { roomType: { select: { name: true } } } },
        guest: true,
        assignments: { include: { unit: { select: { label: true } } } },
      },
    }),
  ]);

  const arrivals: StayRow[] = [];
  const inHouse: StayRow[] = [];
  const departedToday: StayRow[] = [];

  for (const r of reservations) {
    if (r.lines.length === 0) continue;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!;
    const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0]!;
    const ciY = ymd(ci), coY = ymd(co);
    const roomLabel = r.lines.length === 1 ? r.lines[0]!.roomType.name : `${r.lines.reduce((n, l) => n + l.quantity, 0)} rooms`;

    const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
    const assignedUnits = active.map((a) => ({ assignmentId: a.id, unitId: a.unitId, unitLabel: a.unit.label }));

    const row: StayRow = {
      reservationId: r.id, guestName, roomLabel, checkIn: ciY, checkOut: coY,
      nights: nightsBetween(ci, co), status: r.status,
      assignedUnits, dueOutToday: coY === today, overdue: false,
    };

    if (active.length > 0) {
      inHouse.push(row);
    } else {
      const departedTodayHere = r.assignments.some((a) => a.checkedOutAt != null && ymd(a.checkedOutAt) === today);
      if (departedTodayHere) departedToday.push(row);
      else if (ciY <= today) arrivals.push({ ...row, overdue: ciY < today });
    }
  }

  arrivals.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName));
  inHouse.sort((a, b) => Number(b.dueOutToday) - Number(a.dueOutToday) || a.guestName.localeCompare(b.guestName));

  return {
    property,
    today,
    counts: statusCounts(units.map((u) => ({ hkStatus: u.hkStatus as HkStatus }))),
    totalUnits: units.length,
    arrivals,
    inHouse,
    departedToday,
    dueOutCount: inHouse.filter((s) => s.dueOutToday).length,
  };
}

export interface AvailableUnit {
  id: string;
  label: string;
  floor: string | null;
  hkStatus: HkStatus;
  available: boolean; // serviceable AND free for the stay window
  occupied: boolean;
}

/** Units of a room type with availability for a stay window (for check-in / room move). */
export async function availableUnitsFor(roomTypeId: string, checkIn: string, checkOut: string, excludeAssignmentId?: string): Promise<AvailableUnit[]> {
  const units = await prisma.unit.findMany({
    where: { roomTypeId, active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, floor: true, hkStatus: true },
  });
  if (units.length === 0) return [];
  const overlapping = await prisma.roomAssignment.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      status: "active",
      checkedOutAt: null,
      checkIn: { lt: utcDay(checkOut) },
      checkOut: { gt: utcDay(checkIn) },
      ...(excludeAssignmentId ? { id: { not: excludeAssignmentId } } : {}),
    },
    select: { unitId: true },
  });
  const busy = new Set(overlapping.map((a) => a.unitId));
  return units.map((u) => {
    const hk = u.hkStatus as HkStatus;
    const serviceable = hk === "clean" || hk === "inspected";
    return { id: u.id, label: u.label, floor: u.floor, hkStatus: hk, occupied: busy.has(u.id), available: !busy.has(u.id) && serviceable };
  });
}

/** A reservation (scoped to the active property) with its lines + guest + active assignments, for check-in. */
export async function getReservationForCheckin(reservationId: string) {
  const { property } = await activeProperty();
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: {
      lines: { include: { roomType: { select: { id: true, name: true } } } },
      guest: true,
      assignments: { where: { status: "active", checkedOutAt: null }, include: { unit: { select: { label: true } } } },
    },
  });
  return r ? { property, reservation: r } : null;
}

/** One active assignment (scoped) for a room move — with its line's room type + stay window. */
export async function getAssignmentForMove(assignmentId: string) {
  const { property } = await activeProperty();
  const a = await prisma.roomAssignment.findFirst({
    where: { id: assignmentId, propertyId: property.id, status: "active", checkedOutAt: null },
    include: { unit: true, line: { include: { roomType: { select: { id: true, name: true } } } }, reservation: { include: { guest: true } } },
  });
  return a ? { property, assignment: a } : null;
}

/** Room types + the property's standard (manual) rate plan, for the walk-in form. */
export async function getWalkInOptions() {
  const { property } = await activeProperty();
  const [roomTypes, standardPlan] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, maxGuests: true } }),
    prisma.ratePlan.findFirst({ where: { propertyId: property.id, priceLogic: "manual" }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { property, roomTypes, standardPlanId: standardPlan?.id ?? null };
}
