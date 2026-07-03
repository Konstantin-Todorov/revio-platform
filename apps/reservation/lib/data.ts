import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { computeWaterfall, expandInventoryPeriods, SOLD_STATUSES, type WaterfallResult } from "@revio/core";
import { getSession } from "./session";

const DAY = 86_400_000;

export function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "Today" as a calendar date IN THE PROPERTY'S TIME ZONE — never the server's (spec rule). */
export function todayInTz(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** The active property for the current session — scoped to the session's tenant. Every read/write in
 *  this app resolves the property through here, so a hotel can only ever touch its own data. */
export async function getProperty() {
  const session = await getSession();
  if (!session) redirect("/logout");
  return prisma.property.findUniqueOrThrow({
    where: { id: session.activePropertyId },
    include: { tenant: true },
  });
}

// --- Inventory board (the Inventory Calendar) -------------------------------

export interface InventoryQuery {
  start?: string; // YYYY-MM-DD
  days?: number;
}

export interface InventorySection {
  roomType: { id: string; name: string; code: string; totalRooms: number; unitKind: string; active: boolean };
  /** One waterfall per visible date, aligned with `dates`. */
  cells: (WaterfallResult & { manualOverride: boolean })[];
}

const HORIZON_DAYS_MAX = 730;

/**
 * The waterfall for every (room type, date) in the window. Physical/OOO/Closed/Available/Sold/
 * Remaining all come from @revio/core computeWaterfall — this function only assembles inputs
 * (periods, manual sell limits, holds, confirmed lines); it never re-derives availability.
 */
export async function getInventoryBoard(q: InventoryQuery = {}) {
  const property = await getProperty();
  const propertyId = property.id;

  const todayIso = todayInTz(property.timezone);
  const today = new Date(`${todayIso}T00:00:00Z`);
  const minStart = addDays(today, -45);
  const maxStart = addDays(today, HORIZON_DAYS_MAX - 1);

  let start = today;
  if (q.start && /^\d{4}-\d{2}-\d{2}$/.test(q.start)) {
    const parsed = new Date(`${q.start}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) start = new Date(Math.min(Math.max(parsed.getTime(), minStart.getTime()), maxStart.getTime()));
  }
  const days = q.days && q.days >= 1 && q.days <= 31 ? q.days : 14;

  const dates = Array.from({ length: days }, (_, i) => ymd(addDays(start, i)));
  const end = addDays(start, days); // exclusive

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const rtIds = roomTypes.map((r) => r.id);

  const [periods, cells, holds, lines] = await Promise.all([
    prisma.roomInventoryPeriod.findMany({
      where: { roomTypeId: { in: rtIds }, dateFrom: { lt: end }, dateTo: { gte: start } },
    }),
    prisma.dailyCell.findMany({
      where: { roomTypeId: { in: rtIds }, date: { gte: start, lt: end }, inventory: { not: null } },
    }),
    prisma.hold.findMany({
      where: {
        roomTypeId: { in: rtIds },
        status: "active",
        expiresAt: { gt: new Date() },
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
    }),
    prisma.reservationLine.findMany({
      where: {
        roomTypeId: { in: rtIds },
        reservation: { propertyId, status: { in: [...SOLD_STATUSES] } },
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
    }),
  ]);

  const overrideByKey = new Map(cells.map((c) => [`${c.roomTypeId}:${ymd(c.date)}`, c.inventory!]));

  const sections: InventorySection[] = roomTypes.map((rt) => {
    const rtPeriods = periods
      .filter((p) => p.roomTypeId === rt.id)
      .map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms }));
    const periodByDate = expandInventoryPeriods(rtPeriods, dates);

    const cellsOut = dates.map((d) => {
      const soldUnits = lines
        .filter((l) => l.roomTypeId === rt.id && ymd(l.checkIn) <= d && ymd(l.checkOut) > d)
        .reduce((sum, l) => sum + l.quantity, 0);
      const holdUnits = holds
        .filter((h) => h.roomTypeId === rt.id && ymd(h.checkIn) <= d && ymd(h.checkOut) > d)
        .reduce((sum, h) => sum + h.quantity, 0);
      const manual = overrideByKey.get(`${rt.id}:${d}`);
      const { outOfOrder, closed } = periodByDate.get(d)!;
      return {
        ...computeWaterfall({
          physical: rt.totalRooms,
          outOfOrder,
          closed,
          manualSellLimit: manual ?? null,
          holds: holdUnits,
          confirmed: soldUnits,
        }),
        manualOverride: manual != null,
      };
    });

    return {
      roomType: { id: rt.id, name: rt.name, code: rt.code, totalRooms: rt.totalRooms, unitKind: rt.unitKind, active: rt.active },
      cells: cellsOut,
    };
  });

  return {
    property: { id: property.id, name: property.name, currency: property.baseCurrency, timezone: property.timezone },
    sections,
    dates,
    days,
    start: ymd(start),
    todayIso,
  };
}

// --- Inventory Setup ---------------------------------------------------------

export async function getSetupData() {
  const property = await getProperty();
  const [roomTypes, periods] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId: property.id }, orderBy: { sortOrder: "asc" } }),
    prisma.roomInventoryPeriod.findMany({
      where: { propertyId: property.id },
      include: { roomType: { select: { name: true, code: true, totalRooms: true } } },
      orderBy: { dateFrom: "asc" },
    }),
  ]);
  return { property, roomTypes, periods, todayIso: todayInTz(property.timezone) };
}
