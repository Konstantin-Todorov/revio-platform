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
  connectingUnitIds: string[];
  dueOutToday: boolean;
  /** Smart-routing (spec §3.4): lower = clean sooner. Reason is shown so staff trust the order. */
  priority: number;
  cleanReason: string | null;
}

/** Global search across the PMS: rooms (units), guests, and reservations. */
export async function globalSearch(q: string) {
  const { property } = await activeProperty();
  const term = q.trim();
  if (!term) return { property, term, units: [], guests: [], reservations: [] };
  const [units, guests, reservations] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: property.id, label: { contains: term, mode: "insensitive" } }, take: 8, include: { roomType: { select: { name: true } } } }),
    prisma.guest.findMany({ where: { propertyId: property.id, OR: [{ firstName: { contains: term, mode: "insensitive" } }, { lastName: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] }, take: 8 }),
    prisma.reservation.findMany({ where: { propertyId: property.id, guestName: { contains: term, mode: "insensitive" } }, take: 8, include: { lines: { include: { roomType: { select: { name: true } } } } } }),
  ]);
  return { property, term, units, guests, reservations };
}

export interface NotifItem { text: string; href: string; tone: "danger" | "warning" | "info" | "success" }

/** Notification-bell items: what needs attention right now (arrivals, cleaning, OOO, open balances). */
export async function getNotifications(): Promise<{ items: NotifItem[]; count: number }> {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const [reservations, dirty, ooo, openFolios] = await Promise.all([
    prisma.reservation.findMany({ where: { propertyId: property.id, status: { in: [...OCCUPYING] } }, include: { lines: true, assignments: true } }),
    prisma.unit.count({ where: { propertyId: property.id, active: true, hkStatus: "dirty" } }),
    prisma.unit.count({ where: { propertyId: property.id, active: true, hkStatus: "out_of_order" } }),
    prisma.folio.findMany({ where: { propertyId: property.id, status: "open" }, include: { lines: { select: { kind: true, amountMinor: true, voided: true } } } }),
  ]);

  let arrivalsDue = 0;
  for (const r of reservations) {
    if (r.lines.length === 0 || r.assignments.length > 0) continue;
    const ci = ymd(r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!);
    if (ci <= today) arrivalsDue++;
  }
  const unsettled = openFolios.filter((f) => {
    let c = 0, p = 0;
    for (const l of f.lines) { if (l.voided) continue; l.kind === "payment" ? (p += l.amountMinor) : (c += l.amountMinor); }
    return c - p !== 0;
  }).length;

  const items: NotifItem[] = [];
  if (arrivalsDue > 0) items.push({ text: `${arrivalsDue} arrival${arrivalsDue === 1 ? "" : "s"} to check in`, href: "/dashboard", tone: "info" });
  if (dirty > 0) items.push({ text: `${dirty} room${dirty === 1 ? "" : "s"} to clean`, href: "/housekeeping", tone: "warning" });
  if (ooo > 0) items.push({ text: `${ooo} room${ooo === 1 ? "" : "s"} out of order`, href: "/maintenance", tone: "danger" });
  if (unsettled > 0) items.push({ text: `${unsettled} open balance${unsettled === 1 ? "" : "s"}`, href: "/folios", tone: "danger" });
  return { items, count: items.length };
}

/** Settings screen: property profile + its channels (read-only; distribution is managed in RevioLink). */
export async function getPmsSettings() {
  const { property } = await activeProperty();
  const [channels, roomTypes, units, posItems] = await Promise.all([
    prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true, connectivityMode: true } }),
    prisma.roomType.count({ where: { propertyId: property.id, active: true } }),
    prisma.unit.count({ where: { propertyId: property.id, active: true } }),
    prisma.posItem.count({ where: { propertyId: property.id, active: true } }),
  ]);
  return { property, channels, counts: { roomTypes, units, posItems } };
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
  const today = todayInTz(property.timezone);
  const start = new Date(`${today}T00:00:00Z`);
  const next = new Date(start.getTime() + 86_400_000);
  const [units, occupied, arrivalLines] = await Promise.all([
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
    // Arrivals DUE (today or overdue) not yet checked in, by room type → which types need a ready
    // room now. Overdue guests still need a room, so they count toward cleaning pressure.
    prisma.reservationLine.findMany({
      where: { checkIn: { lt: next }, checkOut: { gt: start }, reservation: { propertyId: property.id, status: { in: [...OCCUPYING] } } },
      select: { roomTypeId: true, quantity: true, reservation: { select: { assignments: { where: { status: "active", checkedInAt: { not: null } } } } } },
    }),
  ]);
  const occByUnit = new Map(occupied.map((a) => [a.unitId, { res: a.reservation, checkOut: a.checkOut }]));
  // Arrival pressure per room type = today's arrivals still needing a room (not yet checked in).
  const arrivalsByType = new Map<string, number>();
  for (const l of arrivalLines) {
    if (l.reservation.assignments.length > 0) continue;
    arrivalsByType.set(l.roomTypeId, (arrivalsByType.get(l.roomTypeId) ?? 0) + l.quantity);
  }

  const units2 = units.map((u): UnitRow => {
    const occ = occByUnit.get(u.id);
    const res = occ?.res;
    const guestName = res ? (res.guest ? `${res.guest.firstName} ${res.guest.lastName}`.trim() : res.guestName) : null;
    const dueOutToday = occ ? ymd(occ.checkOut) === today : false;
    const arrivalPressure = (arrivalsByType.get(u.roomTypeId) ?? 0) > 0;

    // Smart routing (spec §3.4): only dirty/in-progress rooms are in the cleaning queue. Order:
    // turn-for-arrival → arrival-today → departure → stayover → no-pressure. Reason shown for trust.
    let priority = 99, cleanReason: string | null = null;
    const needsClean = u.hkStatus === "dirty" || u.hkStatus === "in_progress";
    if (needsClean) {
      if (dueOutToday && arrivalPressure) { priority = 1; cleanReason = "Turn for arrival"; }
      else if (!occ && arrivalPressure) { priority = 2; cleanReason = "Arrival today"; }
      else if (dueOutToday) { priority = 3; cleanReason = "Departure"; }
      else if (occ) { priority = 4; cleanReason = "Stayover"; }
      else { priority = 5; cleanReason = "No arrival pressure"; }
      if (u.hkStatus === "in_progress") priority -= 0.5; // already started → finish it first
    }
    return {
      id: u.id, label: u.label, floor: u.floor, hkStatus: u.hkStatus as HkStatus, active: u.active,
      roomTypeId: u.roomTypeId, roomTypeName: u.roomType.name, occupied: !!res, guestName,
      connectingUnitIds: u.connectingUnitIds, dueOutToday, priority, cleanReason,
    };
  });
  return { property, units: units2 };
}

/** Housekeeping status counts across all active units. */
export function statusCounts(units: { hkStatus: HkStatus }[]): Record<HkStatus, number> {
  const base: Record<HkStatus, number> = { clean: 0, dirty: 0, in_progress: 0, inspected: 0, out_of_order: 0 };
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
  assignedUnits: { assignmentId: string; unitId: string; unitLabel: string; hkStatus: HkStatus }[];
  dueOutToday: boolean;
  overdue: boolean; // arrival date already passed, still not checked in
  /** Arrivals only: is a room of their type clean/inspected right now? (spec §3.1 — "can I check
   * them in now, or am I waiting on housekeeping?"). null on in-house/departure rows. */
  roomReady: "ready" | "partial" | "none" | null;
  /** In-house only: this stay shares a physical room with another in-house guest (double-assignment). */
  conflict: boolean;
}

export interface AssignmentConflict { unitLabel: string; guests: string[] }

/**
 * Assignment-aware front-desk overview (Phase 2 + D2): housekeeping counts + today's arrivals (to check
 * in, with room-ready status), in-house guests (with their assigned room + hk state), explicit departures
 * (due out today), and who departed today. Stay state is derived from RoomAssignment (checkedInAt /
 * checkedOutAt) — the reservation's sold status never changes. Flags double-assignment conflicts.
 */
export async function getFrontDeskOverview() {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);

  const [units, reservations] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: property.id, active: true }, select: { id: true, roomTypeId: true, hkStatus: true } }),
    prisma.reservation.findMany({
      where: { propertyId: property.id, status: { in: [...OCCUPYING] } },
      include: {
        lines: { include: { roomType: { select: { name: true } } } },
        guest: true,
        assignments: { include: { unit: { select: { label: true, hkStatus: true } } } },
      },
    }),
  ]);

  const arrivals: StayRow[] = [];
  const inHouse: StayRow[] = [];
  const departedToday: StayRow[] = [];
  const arrivalNeeds: { row: StayRow; needByType: Map<string, number> }[] = [];
  const unitOccupants = new Map<string, string[]>(); // in-house unitId → guest names (for conflicts + occupancy)

  for (const r of reservations) {
    if (r.lines.length === 0) continue;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!;
    const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0]!;
    const ciY = ymd(ci), coY = ymd(co);
    const roomLabel = r.lines.length === 1 ? r.lines[0]!.roomType.name : `${r.lines.reduce((n, l) => n + l.quantity, 0)} rooms`;

    const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
    const assignedUnits = active.map((a) => ({ assignmentId: a.id, unitId: a.unitId, unitLabel: a.unit.label, hkStatus: a.unit.hkStatus as HkStatus }));

    const row: StayRow = {
      reservationId: r.id, guestName, roomLabel, checkIn: ciY, checkOut: coY,
      nights: nightsBetween(ci, co), status: r.status,
      assignedUnits, dueOutToday: coY === today, overdue: false, roomReady: null, conflict: false,
    };

    if (active.length > 0) {
      inHouse.push(row);
      for (const u of assignedUnits) unitOccupants.set(u.unitId, [...(unitOccupants.get(u.unitId) ?? []), guestName]);
    } else {
      const departedTodayHere = r.assignments.some((a) => a.checkedOutAt != null && ymd(a.checkedOutAt) === today);
      if (departedTodayHere) departedToday.push(row);
      else if (ciY <= today) {
        const arr: StayRow = { ...row, overdue: ciY < today };
        arrivals.push(arr);
        const needByType = new Map<string, number>();
        for (const l of r.lines) needByType.set(l.roomTypeId, (needByType.get(l.roomTypeId) ?? 0) + l.quantity);
        arrivalNeeds.push({ row: arr, needByType });
      }
    }
  }

  // Room-ready = clean/inspected units of the arrival's type that aren't already occupied. This is the
  // single most-used fact at a front desk: can I check them in now, or am I waiting on housekeeping?
  const occupied = new Set(unitOccupants.keys());
  const readyByType = new Map<string, number>();
  for (const u of units) {
    if (occupied.has(u.id)) continue;
    if (u.hkStatus === "clean" || u.hkStatus === "inspected") readyByType.set(u.roomTypeId, (readyByType.get(u.roomTypeId) ?? 0) + 1);
  }
  for (const { row, needByType } of arrivalNeeds) {
    let need = 0, have = 0;
    for (const [rt, q] of needByType) { need += q; have += Math.min(q, readyByType.get(rt) ?? 0); }
    row.roomReady = have >= need ? "ready" : have > 0 ? "partial" : "none";
  }

  // Double-assignment conflicts (spec §3.1) — a physical room holding more than one in-house guest.
  const conflicts: AssignmentConflict[] = [];
  const conflictUnitIds = new Set<string>();
  for (const [unitId, guests] of unitOccupants) {
    if (guests.length > 1) {
      conflictUnitIds.add(unitId);
      const label = inHouse.flatMap((s) => s.assignedUnits).find((u) => u.unitId === unitId)?.unitLabel ?? unitId;
      conflicts.push({ unitLabel: label, guests });
    }
  }
  for (const row of inHouse) row.conflict = row.assignedUnits.some((u) => conflictUnitIds.has(u.unitId));

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
    departures: inHouse.filter((s) => s.dueOutToday),
    dueOutCount: inHouse.filter((s) => s.dueOutToday).length,
    conflicts,
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
