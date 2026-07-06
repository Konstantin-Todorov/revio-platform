import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { computeWaterfall, deriveRate, expandInventoryPeriods, isAdvancePurchaseClosed, resolveRestriction, SOLD_STATUSES, type RestrictionRuleHit, type WaterfallResult } from "@revio/core";
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

export interface NotifItem { text: string; href: string; tone: "danger" | "warning" | "info" | "success" }

/** Notification-bell items: open errors + today's arrivals / departures. */
export async function getNotifications(): Promise<{ items: NotifItem[]; count: number }> {
  const property = await getProperty();
  const today = todayInTz(property.timezone);
  const start = new Date(`${today}T00:00:00Z`);
  const next = new Date(start.getTime() + 86_400_000);
  const [openErrors, arrivals, departures] = await Promise.all([
    prisma.errorItem.count({ where: { propertyId: property.id, resolved: false } }),
    prisma.reservationLine.count({ where: { checkIn: { gte: start, lt: next }, reservation: { propertyId: property.id, status: { in: ["confirmed", "modified"] } } } }),
    prisma.reservationLine.count({ where: { checkOut: { gte: start, lt: next }, reservation: { propertyId: property.id, status: { in: ["confirmed", "modified"] } } } }),
  ]);
  const items: NotifItem[] = [];
  if (openErrors > 0) items.push({ text: `${openErrors} open error${openErrors === 1 ? "" : "s"}`, href: "/distribution", tone: "danger" });
  if (arrivals > 0) items.push({ text: `${arrivals} arrival${arrivals === 1 ? "" : "s"} today`, href: "/reservations", tone: "info" });
  if (departures > 0) items.push({ text: `${departures} departure${departures === 1 ? "" : "s"} today`, href: "/reservations", tone: "info" });
  return { items, count: items.length };
}

// --- Inventory board (the Inventory Calendar) -------------------------------

export interface InventoryQuery {
  start?: string; // YYYY-MM-DD
  days?: number;
}

export interface CellRestrictions {
  stopSell: boolean;
  cta: boolean;
  ctd: boolean;
  minLos: number | null;
}

export interface InventorySection {
  roomType: { id: string; name: string; code: string; totalRooms: number; unitKind: string; active: boolean };
  /** One waterfall per visible date, aligned with `dates`. */
  cells: (WaterfallResult & { manualOverride: boolean; rate: string; restr: CellRestrictions })[];
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

  const [standard, defaults, rules, prices, periods, cells, holds, lines] = await Promise.all([
    prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.propertyDefaults.findUnique({ where: { propertyId } }),
    prisma.restrictionRule.findMany({ where: { propertyId, active: true, dateFrom: { lt: end }, dateTo: { gte: start } } }),
    prisma.ratePrice.findMany({ where: { roomTypeId: { in: rtIds }, date: { gte: start, lt: end } } }),
    prisma.roomInventoryPeriod.findMany({
      where: { roomTypeId: { in: rtIds }, dateFrom: { lt: end }, dateTo: { gte: start } },
    }),
    prisma.dailyCell.findMany({
      where: { roomTypeId: { in: rtIds }, date: { gte: start, lt: end } },
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

  const cellByKey = new Map(cells.map((c) => [`${c.roomTypeId}:${ymd(c.date)}`, c]));
  const priceByKey = new Map(
    standard ? prices.filter((pr) => pr.ratePlanId === standard.id).map((pr) => [`${pr.roomTypeId}:${ymd(pr.date)}`, pr.priceMinor]) : [],
  );

  // Resolve one restriction for one (room type, date) across the FOUR priority levels
  // (manual cell > matching rules > standard-plan default > property default) — display is
  // source-agnostic: a rule scoped to any booking source still shows here.
  function resolveFor(rtId: string, d: string, cell: (typeof cells)[number] | undefined): CellRestrictions {
    const ruleHits = (type: string): RestrictionRuleHit[] =>
      rules
        .filter((r) => r.type === type && (r.roomTypeId == null || r.roomTypeId === rtId) && ymd(r.dateFrom) <= d && ymd(r.dateTo) >= d)
        .map((r) => ({ priority: r.priority, value: (r.valueBool ?? r.valueInt ?? true) as number | boolean }));
    const flag = (type: "stop_sell" | "cta" | "ctd", manual: boolean | undefined, plan: boolean | undefined, prop: boolean | undefined) =>
      Boolean(
        resolveRestriction(type, {
          ...(manual ? { manual: true } : {}),
          matchingRules: ruleHits(type),
          ...(plan ? { ratePlanDefault: true } : {}),
          ...(prop ? { propertyDefault: true } : {}),
        }).value,
      );
    const minRes = resolveRestriction("min_los", {
      ...(cell?.minLos != null ? { manual: cell.minLos } : {}),
      matchingRules: ruleHits("min_los"),
      ...(standard?.defMinLos != null ? { ratePlanDefault: standard.defMinLos } : {}),
      ...(defaults?.defMinLos != null ? { propertyDefault: defaults.defMinLos } : {}),
    });
    return {
      stopSell: flag("stop_sell", cell?.stopSell || undefined, standard?.defStopSell || undefined, defaults?.defStopSell || undefined),
      cta: flag("cta", cell?.cta || undefined, standard?.defCta || undefined, defaults?.defCta || undefined),
      ctd: flag("ctd", cell?.ctd || undefined, standard?.defCtd || undefined, defaults?.defCtd || undefined),
      minLos: minRes.source === "none" ? null : Number(minRes.value),
    };
  }

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
      const cell = cellByKey.get(`${rt.id}:${d}`);
      const manual = cell?.inventory;
      const { outOfOrder, closed } = periodByDate.get(d)!;
      const priceMinor = priceByKey.get(`${rt.id}:${d}`);
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
        rate: priceMinor != null ? String(Math.round(priceMinor / 100)) : "—",
        restr: resolveFor(rt.id, d, cell),
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

// --- Phase 2: availability search, quotes, reservations, guests --------------

export const PAYMENT_GUARANTEES = [
  { value: "card_on_file", label: "Card on file" },
  { value: "company_account", label: "Company account" },
  { value: "prepaid_ota", label: "Prepaid via OTA" },
  { value: "none", label: "No guarantee" },
] as const;

/** Sold statuses (shared) — plus "hold"-status reservations lock inventory via the Hold table. */
function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let t = new Date(`${checkIn}T00:00:00Z`).getTime(); t < new Date(`${checkOut}T00:00:00Z`).getTime(); t += DAY) {
    out.push(ymd(new Date(t)));
  }
  return out;
}

/**
 * The waterfall per night of a stay for one room type. `exclude` lets the modification flow
 * validate a new stay while ignoring the reservation's own line / the hold being converted —
 * the spec's release→validate step, done atomically instead of actually releasing first.
 */
export async function remainingByNight(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  exclude: { reservationId?: string; holdId?: string } = {},
) {
  const nights = nightsOf(checkIn, checkOut);
  if (nights.length === 0) return [];
  const start = new Date(`${nights[0]}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);

  const [rt, cells, periods, holds, lines] = await Promise.all([
    prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } }),
    prisma.dailyCell.findMany({ where: { roomTypeId, date: { gte: start, lt: end }, inventory: { not: null } } }),
    prisma.roomInventoryPeriod.findMany({ where: { roomTypeId, dateFrom: { lt: end }, dateTo: { gte: start } } }),
    prisma.hold.findMany({
      where: {
        roomTypeId, status: "active", expiresAt: { gt: new Date() },
        checkIn: { lt: end }, checkOut: { gt: start },
        ...(exclude.holdId ? { id: { not: exclude.holdId } } : {}),
      },
    }),
    prisma.reservationLine.findMany({
      where: {
        roomTypeId,
        reservation: { status: { in: [...SOLD_STATUSES] } },
        checkIn: { lt: end }, checkOut: { gt: start },
        ...(exclude.reservationId ? { reservationId: { not: exclude.reservationId } } : {}),
      },
    }),
  ]);

  const overrideByDate = new Map(cells.map((c) => [ymd(c.date), c.inventory!]));
  const periodByDate = expandInventoryPeriods(
    periods.map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms })),
    nights,
  );

  return nights.map((d) => {
    const sold = lines.filter((l) => ymd(l.checkIn) <= d && ymd(l.checkOut) > d).reduce((s, l) => s + l.quantity, 0);
    const held = holds.filter((h) => ymd(h.checkIn) <= d && ymd(h.checkOut) > d).reduce((s, h) => s + h.quantity, 0);
    const { outOfOrder, closed } = periodByDate.get(d)!;
    return {
      date: d,
      ...computeWaterfall({
        physical: rt.totalRooms, outOfOrder, closed,
        manualSellLimit: overrideByDate.get(d) ?? null,
        holds: held, confirmed: sold,
      }),
    };
  });
}

/** Total accommodation price for a stay on one (room type, rate plan) — derived plans computed from
 *  the parent's stored nightly prices via @revio/core. Null when any night lacks a price. */
export async function stayQuote(roomTypeId: string, ratePlanId: string, checkIn: string, checkOut: string, quantity = 1) {
  const nights = nightsOf(checkIn, checkOut);
  const rp = await prisma.ratePlan.findUniqueOrThrow({ where: { id: ratePlanId } });
  const priceSourceId = rp.priceLogic === "derived" && rp.parentRatePlanId ? rp.parentRatePlanId : rp.id;
  const rows = await prisma.ratePrice.findMany({
    where: { roomTypeId, ratePlanId: priceSourceId, date: { gte: new Date(`${checkIn}T00:00:00Z`), lt: new Date(`${checkOut}T00:00:00Z`) } },
  });
  const byDate = new Map(rows.map((r) => [ymd(r.date), r.priceMinor]));

  let total = 0;
  for (const d of nights) {
    const base = byDate.get(d);
    if (base == null) return null;
    if (rp.priceLogic === "derived" && rp.parentRatePlanId) {
      total += deriveRate(base, {
        parentRatePlanId: rp.parentRatePlanId,
        adjustmentType: (rp.derivedType as "percent" | "fixed") ?? "percent",
        direction: (rp.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: rp.derivedValue ?? 0,
        rounding: (rp.derivedRounding as Parameters<typeof deriveRate>[1]["rounding"]) ?? "none",
        ...(rp.derivedFloorMinor != null ? { floorMinor: rp.derivedFloorMinor } : {}),
        ...(rp.derivedCeilingMinor != null ? { ceilingMinor: rp.derivedCeilingMinor } : {}),
      });
    } else {
      total += base;
    }
  }
  return total * quantity;
}

export interface StaySearch {
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
  roomTypeId?: string;
  /** BookingSource.category the agent is selling through — restriction rules may scope to it. */
  sourceCategory?: string;
}

/**
 * Availability Search — the call-center entry point (docs/CRS-REFERENCE.md). Answers the
 * guest-stay-shaped question for every room type at once so the agent can offer alternatives
 * (other available rooms when the requested one is full) and upgrades without a second query.
 */
export async function searchAvailability(q: StaySearch) {
  const property = await getProperty();
  const roomTypes = await prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } });
  const standard = await prisma.ratePlan.findFirst({ where: { propertyId: property.id, priceLogic: "manual", active: true }, orderBy: { sortOrder: "asc" } });

  const results = await Promise.all(
    roomTypes.map(async (rt) => {
      const nights = await remainingByNight(rt.id, q.checkIn, q.checkOut);
      const remainingMin = nights.length ? Math.min(...nights.map((n) => n.remaining)) : 0;
      const totalMinor = standard ? await stayQuote(rt.id, standard.id, q.checkIn, q.checkOut, q.quantity) : null;
      const blocked = remainingMin >= q.quantity ? await stayViolation(rt.id, q.checkIn, q.checkOut, q.sourceCategory) : null;
      return {
        roomType: rt,
        remainingMin,
        fitsGuests: rt.maxGuests * q.quantity >= q.guests,
        available: remainingMin >= q.quantity && !blocked,
        blocked,
        totalMinor,
        requested: q.roomTypeId ? q.roomTypeId === rt.id : true,
      };
    }),
  );

  return { property, results, standardPlanName: standard?.name ?? null, nights: nightsOf(q.checkIn, q.checkOut).length };
}

export async function getCreateFormData() {
  const property = await getProperty();
  const [roomTypes, ratePlans, sources] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findMany({ where: { propertyId: property.id, active: true }, include: { cancellationPolicy: true }, orderBy: { sortOrder: "asc" } }),
    prisma.bookingSource.findMany({ where: { propertyId: property.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  return { property, roomTypes, ratePlans, sources };
}

export interface CrsReservationFilters {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}

export async function getReservationsList(filters: CrsReservationFilters = {}) {
  const property = await getProperty();
  const lineDate: Record<string, Date> = {};
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) lineDate.gte = utcDayLocal(filters.from);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) lineDate.lte = utcDayLocal(filters.to);

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: property.id,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { guestName: { contains: filters.q, mode: "insensitive" } },
              { id: { contains: filters.q } },
              { guest: { email: { contains: filters.q, mode: "insensitive" } } },
              { guest: { phone: { contains: filters.q } } },
            ],
          }
        : {}),
      ...(Object.keys(lineDate).length ? { lines: { some: { checkIn: lineDate } } } : {}),
    },
    include: {
      channel: { select: { name: true } },
      bookingSource: { select: { name: true } },
      guest: { select: { id: true, email: true, phone: true } },
      lines: { include: { roomType: { select: { name: true, code: true } } } },
    },
    orderBy: { importedAt: "desc" },
    take: 200,
  });
  return { property, reservations };
}

function utcDayLocal(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export async function getReservationDetail(id: string) {
  const property = await getProperty();
  const reservation = await prisma.reservation.findFirst({
    where: { id, propertyId: property.id },
    include: {
      channel: { select: { name: true } },
      bookingSource: { select: { name: true } },
      guest: true,
      holds: { orderBy: { createdAt: "desc" } },
      lines: { include: { roomType: true, ratePlan: { select: { name: true } } } },
    },
  });
  if (!reservation) return null;
  // Reservation Timeline = the audit log pre-filtered to this reservation (tagged by short id).
  const timeline = await prisma.auditEntry.findMany({
    where: { propertyId: property.id, entity: { contains: `#${id.slice(-6)}` } },
    orderBy: { createdAt: "asc" },
  });
  return { property, reservation, timeline, todayIso: todayInTz(property.timezone) };
}

export async function getGuests(q?: string) {
  const property = await getProperty();
  const guests = await prisma.guest.findMany({
    where: {
      propertyId: property.id,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { reservations: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
  });
  return { property, guests };
}

export async function getGuestDetail(id: string) {
  const property = await getProperty();
  const guest = await prisma.guest.findFirst({
    where: { id, propertyId: property.id },
    include: {
      reservations: {
        include: { lines: { include: { roomType: { select: { name: true } } } }, bookingSource: { select: { name: true } }, channel: { select: { name: true } } },
        orderBy: { importedAt: "desc" },
      },
    },
  });
  return guest ? { property, guest } : null;
}

// --- Phase 3: restriction enforcement at the point of sale --------------------

/**
 * Would selling this stay violate a restriction? Resolves stop-sell / CTA / min-LOS /
 * advance-purchase across the four priority levels, honouring booking-source scope
 * (a rule with sourceCategories only fires for reservations from those categories).
 * Returns a human-readable reason, or null when the stay is sellable.
 */
export async function stayViolation(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  sourceCategory?: string,
): Promise<string | null> {
  const property = await getProperty();
  const propertyId = property.id;
  const nights = nightsOf(checkIn, checkOut);
  if (nights.length === 0) return "Departure must be after arrival.";
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);

  const [standard, defaults, cells, rules] = await Promise.all([
    prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.propertyDefaults.findUnique({ where: { propertyId } }),
    prisma.dailyCell.findMany({ where: { roomTypeId, date: { gte: start, lt: end } } }),
    prisma.restrictionRule.findMany({
      where: { propertyId, active: true, dateFrom: { lt: end }, dateTo: { gte: start } },
    }),
  ]);
  const cellByDate = new Map(cells.map((c) => [ymd(c.date), c]));

  const hits = (type: string, d: string): RestrictionRuleHit[] =>
    rules
      .filter(
        (r) =>
          r.type === type &&
          (r.roomTypeId == null || r.roomTypeId === roomTypeId) &&
          ymd(r.dateFrom) <= d && ymd(r.dateTo) >= d &&
          (r.sourceCategories.length === 0 || (sourceCategory != null && r.sourceCategories.includes(sourceCategory))),
      )
      .map((r) => ({ priority: r.priority, value: (r.valueBool ?? r.valueInt ?? true) as number | boolean }));

  // Stop sell — any night closes the whole stay.
  for (const d of nights) {
    const cell = cellByDate.get(d);
    const stop = resolveRestriction("stop_sell", {
      ...(cell?.stopSell ? { manual: true } : {}),
      matchingRules: hits("stop_sell", d),
      ...(standard?.defStopSell ? { ratePlanDefault: true } : {}),
      ...(defaults?.defStopSell ? { propertyDefault: true } : {}),
    });
    if (stop.value) return `Closed to sale on ${d} (stop sell — ${stop.source.replace(/_/g, " ")}).`;
  }

  // Closed to arrival — the check-in night only.
  const arrivalCell = cellByDate.get(checkIn);
  const cta = resolveRestriction("cta", {
    ...(arrivalCell?.cta ? { manual: true } : {}),
    matchingRules: hits("cta", checkIn),
    ...(standard?.defCta ? { ratePlanDefault: true } : {}),
    ...(defaults?.defCta ? { propertyDefault: true } : {}),
  });
  if (cta.value) return `Arrivals are closed on ${checkIn}.`;

  // Minimum stay — resolved for the arrival night.
  const minRes = resolveRestriction("min_los", {
    ...(arrivalCell?.minLos != null ? { manual: arrivalCell.minLos } : {}),
    matchingRules: hits("min_los", checkIn),
    ...(standard?.defMinLos != null ? { ratePlanDefault: standard.defMinLos } : {}),
    ...(defaults?.defMinLos != null ? { propertyDefault: defaults.defMinLos } : {}),
  });
  if (minRes.source !== "none" && nights.length < Number(minRes.value)) {
    return `Minimum stay is ${minRes.value} nights for ${checkIn}.`;
  }

  // Advance purchase — rolling window against the property's "today".
  const todayIso = todayInTz(property.timezone);
  const apOf = (type: string, planVal: number | null | undefined, propVal: number | null | undefined) => {
    const r = resolveRestriction(type as Parameters<typeof resolveRestriction>[0], {
      matchingRules: hits(type, checkIn),
      ...(planVal != null ? { ratePlanDefault: planVal } : {}),
      ...(propVal != null ? { propertyDefault: propVal } : {}),
    });
    return r.source === "none" ? null : Number(r.value);
  };
  const apMin = apOf("advance_purchase_min", standard?.defAdvancePurchaseMin, defaults?.defAdvancePurchaseMin);
  const apMax = apOf("advance_purchase_max", standard?.defAdvancePurchaseMax, defaults?.defAdvancePurchaseMax);
  if (isAdvancePurchaseClosed(todayIso, checkIn, { min: apMin, max: apMax })) {
    return `The advance-purchase window for ${checkIn} is closed (book ${apMin != null ? `≥${apMin}` : ""}${apMin != null && apMax != null ? " and " : ""}${apMax != null ? `≤${apMax}` : ""} days ahead).`;
  }

  return null;
}

// --- Rates & Restrictions screen ----------------------------------------------

export async function getRatesData() {
  const property = await getProperty();
  const [ratePlans, rules, defaults, roomTypes, channels] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      include: { parent: { select: { name: true } }, mealPlan: { select: { name: true } }, cancellationPolicy: { select: { name: true, code: true } }, _count: { select: { roomTypeLinks: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.restrictionRule.findMany({ where: { propertyId: property.id }, orderBy: [{ active: "desc" }, { dateFrom: "asc" }] }),
    prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  return { property, ratePlans, rules, defaults, roomTypes, channels };
}

// --- Global Search (reachable from anywhere — the topbar) ----------------------

/** One query across reservations: ID, guest name/phone/email/company, room, channel, source, status. */
export async function globalSearch(q: string) {
  const property = await getProperty();
  const needle = q.trim();
  if (!needle) return { property, reservations: [] };
  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: property.id,
      OR: [
        { guestName: { contains: needle, mode: "insensitive" } },
        { id: { contains: needle } },
        { externalId: { contains: needle } },
        { status: needle.toLowerCase().replace(/ /g, "_") },
        { notes: { contains: needle, mode: "insensitive" } },
        { guest: { email: { contains: needle, mode: "insensitive" } } },
        { guest: { phone: { contains: needle } } },
        { guest: { company: { contains: needle, mode: "insensitive" } } },
        { channel: { name: { contains: needle, mode: "insensitive" } } },
        { bookingSource: { name: { contains: needle, mode: "insensitive" } } },
        { lines: { some: { roomType: { name: { contains: needle, mode: "insensitive" } } } } },
      ],
    },
    include: {
      channel: { select: { name: true } },
      bookingSource: { select: { name: true } },
      guest: { select: { email: true, phone: true } },
      lines: { include: { roomType: { select: { name: true } } } },
    },
    orderBy: { importedAt: "desc" },
    take: 50,
  });
  return { property, reservations };
}
