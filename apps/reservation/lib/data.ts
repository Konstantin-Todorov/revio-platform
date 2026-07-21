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
 *  this app resolves the property through here, so a hotel can only ever touch its own data. In group
 *  scope this is the auto-selected primary property (operational screens still work on one property). */
export async function getProperty() {
  const session = await getSession();
  if (!session) redirect("/logout");
  return prisma.property.findUniqueOrThrow({
    where: { id: session.activePropertyId },
    include: { tenant: true },
  });
}

export interface CrsScope {
  scope: "property" | "group";
  /** Every property the current view spans — one in property scope, all tenant properties in group. */
  propertyIds: string[];
  /** Representative property for display (timezone, currency, name). In group scope = the first. */
  primary: Awaited<ReturnType<typeof getProperty>>;
  count: number;
  label: string;
}

/** Resolve the reporting scope (CRS-GUIDE §4.1). Dashboard + Analytics read THIS instead of
 *  getProperty() so they can sum across the whole portfolio when the user picks "All properties".
 *  Ratios are always recomputed from summed numerators/denominators — never averaged. */
export async function getScope(): Promise<CrsScope> {
  const session = await getSession();
  if (!session) redirect("/logout");
  if (session.scope === "group") {
    const properties = await prisma.property.findMany({
      where: { tenantId: session.tenantId },
      include: { tenant: true },
      orderBy: { name: "asc" },
    });
    const primary = properties[0]!;
    return {
      scope: "group",
      propertyIds: properties.map((p) => p.id),
      primary,
      count: properties.length,
      label: `All properties · ${properties.length} hotels`,
    };
  }
  const primary = await getProperty();
  return { scope: "property", propertyIds: [primary.id], primary, count: 1, label: primary.name };
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

  // Resolve one restriction for one (room type, date) via the TWO-TIER precedence
  // (date-scoped cell [calendar/bulk, recency] > matching rules > standard-plan default >
  // property default — spec §1.4) — display is source-agnostic: a rule scoped to any
  // booking source still shows here.
  function resolveFor(rtId: string, d: string, cell: (typeof cells)[number] | undefined): CellRestrictions {
    const ruleHits = (type: string): RestrictionRuleHit[] =>
      rules
        .filter((r) => r.type === type && (r.roomTypeId == null || r.roomTypeId === rtId) && ymd(r.dateFrom) <= d && ymd(r.dateTo) >= d)
        .map((r) => ({ priority: r.priority, value: (r.valueBool ?? r.valueInt ?? true) as number | boolean }));
    const flag = (type: "stop_sell" | "cta" | "ctd", dateScoped: boolean | undefined, plan: boolean | undefined, prop: boolean | undefined) =>
      Boolean(
        resolveRestriction(type, {
          ...(dateScoped ? { dateScoped: true } : {}),
          matchingRules: ruleHits(type),
          ...(plan ? { ratePlanDefault: true } : {}),
          ...(prop ? { propertyDefault: true } : {}),
        }).value,
      );
    const minRes = resolveRestriction("min_los", {
      ...(cell?.minLos != null ? { dateScoped: cell.minLos } : {}),
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

export type CrsDateType = "check_in" | "check_out" | "created" | "cancelled" | "stay";

export interface CrsReservationFilters {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  /** Which date the from→to range applies to (spec §3.3, same semantics as RevioLink). */
  dateType?: CrsDateType;
}

export async function getReservationsList(filters: CrsReservationFilters = {}) {
  const property = await getProperty();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const R1 = filters.from && iso.test(filters.from) ? utcDayLocal(filters.from) : undefined;
  const R2 = filters.to && iso.test(filters.to) ? utcDayLocal(filters.to) : undefined;
  const R2end = filters.to && iso.test(filters.to) ? new Date(`${filters.to}T23:59:59.999Z`) : undefined;
  const type: CrsDateType = filters.dateType ?? "check_in";

  // Date-type filter (spec §3.3): which date the range governs. Stay-in = OVERLAP with strict >
  // on departure (checkout day is not a stayed night); cancellation auto-scopes to cancelled.
  let dateWhere: Record<string, unknown> = {};
  let statusOverride: string | undefined;
  if (R1 || R2) {
    if (type === "check_in") dateWhere = { lines: { some: { checkIn: { ...(R1 ? { gte: R1 } : {}), ...(R2 ? { lte: R2 } : {}) } } } };
    else if (type === "check_out") dateWhere = { lines: { some: { checkOut: { ...(R1 ? { gte: R1 } : {}), ...(R2 ? { lte: R2 } : {}) } } } };
    else if (type === "created") dateWhere = { importedAt: { ...(R1 ? { gte: R1 } : {}), ...(R2end ? { lte: R2end } : {}) } };
    else if (type === "cancelled") {
      dateWhere = { cancelledAt: { ...(R1 ? { gte: R1 } : {}), ...(R2end ? { lte: R2end } : {}) } };
      if (!filters.status) statusOverride = "cancelled";
    } else if (type === "stay") dateWhere = { lines: { some: { ...(R2 ? { checkIn: { lte: R2 } } : {}), ...(R1 ? { checkOut: { gt: R1 } } : {}) } } };
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: property.id,
      ...(filters.status ? { status: filters.status } : statusOverride ? { status: statusOverride } : {}),
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
      ...dateWhere,
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

/** Live holds (spec §3.3): a Hold with a running TTL is ACTIONABLE and must be visible —
 * never hidden behind "Any status". */
export async function getActiveHolds() {
  const property = await getProperty();
  return prisma.hold.findMany({
    where: { propertyId: property.id, status: "active", expiresAt: { gt: new Date() } },
    include: { roomType: { select: { name: true } }, reservation: { select: { id: true, guestName: true } } },
    orderBy: { expiresAt: "asc" },
  });
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
  if (!guest) return null;

  // --- Preference layer (spec §3.4) — the edge of "not a CRM", deliberately light. ---
  // CRS-DERIVABLE (computed here, from booking history):
  const DAY = 86_400_000;
  const sold = guest.reservations.filter((r) => !["cancelled", "expired", "failed", "failed_import", "draft"].includes(r.status));
  const roomCounts = new Map<string, number>();
  let nights = 0;
  let leadDaysTotal = 0;
  let leadCount = 0;
  let lifetimeMinor = 0;
  for (const r of sold) {
    lifetimeMinor += r.propertyTotalMinor ?? r.totalMinor;
    for (const l of r.lines) {
      const n = Math.max(1, Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / DAY)) * l.quantity;
      nights += n;
      roomCounts.set(l.roomType.name, (roomCounts.get(l.roomType.name) ?? 0) + n);
      leadDaysTotal += Math.max(0, Math.round((l.checkIn.getTime() - r.importedAt.getTime()) / DAY));
      leadCount++;
    }
  }
  const cancelled = guest.reservations.filter((r) => r.status === "cancelled").length;
  const noShows = guest.reservations.filter((r) => r.status === "no_show").length;
  const preferredRoomType = [...roomCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const derived = {
    preferredRoomType,
    avgLosNights: sold.length > 0 ? nights / sold.length : 0,
    avgLeadDays: leadCount > 0 ? Math.round(leadDaysTotal / leadCount) : 0,
    stays: sold.length,
    lifetimeAccommodationMinor: lifetimeMinor,
    cancelled,
    noShows,
    totalBookings: guest.reservations.length,
  };

  // PMS/POS-SOURCED (display-only — the PMS wrote these to the shared core; the CRS never
  // computes POS analytics of its own; empty in standalone / CRS-without-PMS):
  const resIds = guest.reservations.map((r) => r.id);
  const [posAgg, assignments] = await Promise.all([
    prisma.folioLine.aggregate({
      where: { folio: { reservationId: { in: resIds } }, kind: { in: ["minibar", "extra"] }, voided: false },
      _sum: { amountMinor: true },
    }),
    prisma.roomAssignment.findMany({
      where: { reservationId: { in: resIds } },
      include: { unit: { select: { label: true, floor: true } } },
    }),
  ]);
  const unitCounts = new Map<string, number>();
  const floorCounts = new Map<string, number>();
  for (const a of assignments) {
    unitCounts.set(a.unit.label, (unitCounts.get(a.unit.label) ?? 0) + 1);
    if (a.unit.floor) floorCounts.set(a.unit.floor, (floorCounts.get(a.unit.floor) ?? 0) + 1);
  }
  const fromPms = {
    hasPmsData: posAgg._sum.amountMinor != null || assignments.length > 0,
    ancillarySpendMinor: posAgg._sum.amountMinor ?? 0,
    avgAncillaryPerStayMinor: sold.length > 0 ? Math.round((posAgg._sum.amountMinor ?? 0) / sold.length) : 0,
    favouriteUnit: [...unitCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    favouriteFloor: [...floorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };

  // Free-text staff notes (CRS-REFINEMENT-R2 §4) — newest first, on the shared guest record.
  const notes = await prisma.guestNote.findMany({
    where: { guestId: guest.id },
    orderBy: { createdAt: "desc" },
  });

  return { property, guest, derived, fromPms, notes };
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
      ...(cell?.stopSell ? { dateScoped: true } : {}),
      matchingRules: hits("stop_sell", d),
      ...(standard?.defStopSell ? { ratePlanDefault: true } : {}),
      ...(defaults?.defStopSell ? { propertyDefault: true } : {}),
    });
    if (stop.value) return `Closed to sale on ${d} (stop sell — ${stop.source.replace(/_/g, " ")}).`;
  }

  // Closed to arrival — the check-in night only.
  const arrivalCell = cellByDate.get(checkIn);
  const cta = resolveRestriction("cta", {
    ...(arrivalCell?.cta ? { dateScoped: true } : {}),
    matchingRules: hits("cta", checkIn),
    ...(standard?.defCta ? { ratePlanDefault: true } : {}),
    ...(defaults?.defCta ? { propertyDefault: true } : {}),
  });
  if (cta.value) return `Arrivals are closed on ${checkIn}.`;

  // Minimum stay — resolved for the arrival night.
  const minRes = resolveRestriction("min_los", {
    ...(arrivalCell?.minLos != null ? { dateScoped: arrivalCell.minLos } : {}),
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
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, code: true } }),
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
