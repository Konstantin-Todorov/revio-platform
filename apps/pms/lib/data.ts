import "server-only";
import { prisma } from "./db";
import { getSession } from "./session";
import { todayInTz, ymd } from "./format";
import type { HkStatus } from "./hk-meta";

// Statuses that actually occupy a room tonight (front-desk view). Distinct from the metrics
// SOLD_STATUSES (which also counts no_show/overbooked) — an in-house guest is confirmed/modified.
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

/** Every unit (with room type + floor), for the housekeeping board. */
export async function getHousekeepingUnits(): Promise<{ property: Awaited<ReturnType<typeof activeProperty>>["property"]; units: UnitRow[] }> {
  const { property } = await activeProperty();
  const units = await prisma.unit.findMany({
    where: { propertyId: property.id, active: true },
    orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: { roomType: { select: { name: true } } },
  });
  return {
    property,
    units: units.map((u) => ({
      id: u.id,
      label: u.label,
      floor: u.floor,
      hkStatus: u.hkStatus as HkStatus,
      active: u.active,
      roomTypeId: u.roomTypeId,
      roomTypeName: u.roomType.name,
    })),
  };
}

/** Housekeeping status counts across all active units. */
export function statusCounts(units: { hkStatus: HkStatus }[]): Record<HkStatus, number> {
  const base: Record<HkStatus, number> = { clean: 0, dirty: 0, inspected: 0, out_of_order: 0 };
  for (const u of units) base[u.hkStatus] = (base[u.hkStatus] ?? 0) + 1;
  return base;
}

export interface FrontDeskArrival {
  reservationId: string;
  guestName: string;
  roomTypeName: string;
  nights: number;
  status: string;
}

/**
 * The Phase-1 front-desk overview: housekeeping status counts + today's arrivals / departures /
 * in-house, derived from confirmed reservations (property timezone). Room assignment + check-in happen
 * in Phase 2 — for now this shows who is expected, from the shared reservation record.
 */
export async function getFrontDeskOverview() {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);

  const [units, reservations] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: property.id, active: true }, select: { hkStatus: true } }),
    prisma.reservation.findMany({
      where: { propertyId: property.id, status: { in: [...OCCUPYING] } },
      include: { lines: { include: { roomType: { select: { name: true } } } }, guest: true },
    }),
  ]);

  const arrivals: FrontDeskArrival[] = [];
  const departures: FrontDeskArrival[] = [];
  const inHouse: FrontDeskArrival[] = [];

  for (const r of reservations) {
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    for (const line of r.lines) {
      const ci = ymd(line.checkIn);
      const co = ymd(line.checkOut);
      const nights = Math.max(1, Math.round((line.checkOut.getTime() - line.checkIn.getTime()) / 86_400_000));
      const row: FrontDeskArrival = { reservationId: r.id, guestName, roomTypeName: line.roomType.name, nights, status: r.status };
      if (ci === today) arrivals.push(row);
      if (co === today) departures.push(row);
      if (ci <= today && today < co) inHouse.push(row);
    }
  }

  return {
    property,
    today,
    counts: statusCounts(units.map((u) => ({ hkStatus: u.hkStatus as HkStatus }))),
    totalUnits: units.length,
    arrivals,
    departures,
    inHouse,
  };
}
