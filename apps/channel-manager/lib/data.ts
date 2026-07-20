import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { deriveRate, isAdvancePurchaseClosed, SOLD_STATUSES, unsupportedRestrictions, type DerivedRateConfig } from "@revio/core";
import { getSession } from "./session";

const DAY = 86_400_000;
function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
function currentMonday(): Date {
  const today = utcDate(new Date());
  return addDays(today, -((today.getUTCDay() + 6) % 7));
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

/** Notification-bell items: open errors, recent sync failures, and unmapped products. */
export async function getNotifications(): Promise<{ items: NotifItem[]; count: number }> {
  const property = await getProperty();
  const since = new Date(Date.now() - DAY);
  const [openErrors, unmappedRates, unmappedRooms, failed] = await Promise.all([
    prisma.errorItem.count({ where: { propertyId: property.id, resolved: false } }),
    prisma.channelRatePlanMapping.count({ where: { tenantId: property.tenantId, status: { not: "complete" } } }),
    prisma.channelRoomTypeMapping.count({ where: { tenantId: property.tenantId, status: { not: "complete" } } }),
    prisma.syncEvent.count({ where: { propertyId: property.id, status: "failed", createdAt: { gte: since } } }),
  ]);
  const unmapped = unmappedRates + unmappedRooms;
  const items: NotifItem[] = [];
  if (openErrors > 0) items.push({ text: `${openErrors} open error${openErrors === 1 ? "" : "s"}`, href: "/sync", tone: "danger" });
  if (failed > 0) items.push({ text: `${failed} sync failure${failed === 1 ? "" : "s"} (24h)`, href: "/sync", tone: "danger" });
  if (unmapped > 0) items.push({ text: `${unmapped} unmapped product${unmapped === 1 ? "" : "s"}`, href: "/mapping", tone: "warning" });
  return { items, count: items.length };
}

/** Global search across the CM: room types, rate plans, channels, and imported reservations. */
export async function cmSearch(q: string) {
  const property = await getProperty();
  const term = q.trim();
  if (!term) return { property, term, roomTypes: [], ratePlans: [], channels: [], reservations: [] };
  const [roomTypes, ratePlans, channels, reservations] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId: property.id, name: { contains: term, mode: "insensitive" } }, take: 8 }),
    prisma.ratePlan.findMany({ where: { propertyId: property.id, name: { contains: term, mode: "insensitive" } }, take: 8 }),
    prisma.channel.findMany({ where: { propertyId: property.id, name: { contains: term, mode: "insensitive" } }, take: 8 }),
    prisma.reservation.findMany({ where: { propertyId: property.id, OR: [{ guestName: { contains: term, mode: "insensitive" } }, { externalId: { contains: term, mode: "insensitive" } }] }, take: 8, include: { channel: { select: { name: true } } } }),
  ]);
  return { property, term, roomTypes, ratePlans, channels, reservations };
}

export async function getDashboard() {
  const property = await getProperty();
  const propertyId = property.id;

  const [channels, ratePlanLinks, mappings, reservations, syncEvents, errorItems, dailyStopSells] =
    await Promise.all([
      prisma.channel.findMany({ where: { propertyId }, orderBy: { name: "asc" } }),
      prisma.ratePlanRoomType.count({ where: { ratePlan: { propertyId, active: true } } }),
      (async () => {
        const [rt, rp] = await Promise.all([
          prisma.channelRoomTypeMapping.count({ where: { channel: { propertyId }, status: { not: "complete" } } }),
          prisma.channelRatePlanMapping.count({ where: { channel: { propertyId }, status: { not: "complete" } } }),
        ]);
        return rt + rp;
      })(),
      prisma.reservation.findMany({
        where: { propertyId },
        include: { channel: true, lines: { include: { roomType: true } } },
        orderBy: { importedAt: "desc" },
        take: 6,
      }),
      // Boundary rule (spec §1): the activity feed shows channel I/O only.
      prisma.syncEvent.findMany({ where: { propertyId, kind: { in: ["push", "pull"] } }, include: { channel: true }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.errorItem.findMany({ where: { propertyId, resolved: false }, include: { channel: true } }),
      prisma.dailyCell.count({ where: { propertyId, stopSell: true } }),
    ]);

  const connected = channels.filter((c) => c.status === "connected").length;
  const pending = channels.reduce((s, c) => s + c.pendingCount, 0);
  // Failed = REAL failures in the last 24h (spec §3.1/§5.2): failed pushes/pulls plus real open
  // errors — capability mismatches never count (they aren't even sent since the capability map).
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failed24h, oldestPending] = await Promise.all([
    prisma.syncEvent.count({ where: { propertyId, status: "failed", createdAt: { gte: since24h } } }),
    prisma.syncEvent.findFirst({ where: { propertyId, status: "pending" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const failed = failed24h + errorItems.filter((e) => e.severity === "critical" && e.code !== "restriction_not_supported").length;
  // Real errors per channel for the Channel Status table (limitations excluded).
  const realErrorsByChannel = new Map<string, number>();
  for (const e of errorItems) {
    if (e.code === "restriction_not_supported" || !e.channelId) continue;
    realErrorsByChannel.set(e.channelId, (realErrorsByChannel.get(e.channelId) ?? 0) + 1);
  }
  const lastSync = channels.map((c) => c.lastSyncAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
  const currencyWarnings = channels.filter((c) => c.currency !== property.baseCurrency).length;

  return {
    property,
    stats: {
      connectedChannels: connected,
      totalChannels: channels.length,
      activeProducts: ratePlanLinks,
      unmappedProducts: mappings,
      pendingUpdates: pending,
      // Age of the oldest queued item (spec §5.3) — a growing age means the queue is stuck.
      oldestPendingAt: oldestPending?.createdAt ?? null,
      failedSyncs: failed,
      lastSync,
      stopSold: dailyStopSells,
      currencyWarnings,
    },
    channels,
    realErrorsByChannel,
    reservations,
    syncEvents,
    errorItems,
  };
}

export type CalendarRow = {
  key: string;
  label: string;
  kind: "availability" | "price" | "restriction" | "flag";
  /** Derived/secondary rows render in a muted style. */
  muted?: boolean;
  /** Which DailyCell/RatePrice field this row edits (absent ⇒ read-only, e.g. derived rates / rooms sold). */
  field?: "inventory" | "price" | "minLos" | "cta" | "ctd" | "stopSell";
  editable?: boolean;
  /** Set on a derived rate row (spec §2.3): the grid marks it with a paperclip; hover shows parent + offset. */
  derived?: { parent: string; offset: string };
  cells: { date: string; value: string; flag?: "stop" | "ctd" | "cta"; muted?: boolean; warn?: string }[];
};

/** Board query: window start (YYYY-MM-DD), window size, room-type filter, visible row groups. */
export interface CalendarQuery {
  start?: string;
  days?: number;
  rt?: string[];    // room-type codes to show (empty = all)
  rows?: string[];  // visible optional row groups (sold|minlos|cta|ctd|stopsell)
  rp?: string[];    // rate-plan codes whose rate rows show (spec §2.3 named multi-select; empty = default Standard + NR/BRF)
  rateRows?: "grid" | "month"; // grid: rate rows governed solely by the Rates filter; month: standard only, no derived
}

// Spec §2.2: "Derived rates" is NO LONGER a display toggle — rate-row visibility is governed solely by
// the Rates multi-select (rp), and derived status is shown inline via a paperclip (§2.3).
export const CALENDAR_ROW_GROUPS = [
  ["sold", "Rooms sold"],
  ["minlos", "Min LOS"],
  ["cta", "CTA"],
  ["ctd", "CTD"],
  ["stopsell", "Stop sell"],
] as const;

const HORIZON_DAYS_MAX = 730; // 2-year sync horizon (spec)

/**
 * The V2 calendar: EVERY room type as a collapsible section over a movable window (7/14/30 days,
 * up to 2 years ahead), with per-room rows chosen via "Customise display".
 */
export async function getCalendarBoard(q: CalendarQuery) {
  const property = await getProperty();
  const propertyId = property.id;
  // 7/14/30 from the view toggle; the month view passes the exact month length (28–31).
  const days = q.days && q.days >= 1 && q.days <= 31 ? q.days : 14;

  // Window start: requested date clamped to [today-7d, today+2y-days]; default = Monday of this week.
  const today = utcDate(new Date());
  const minStart = addDays(today, -45); // allows the month view to start at the 1st of the current month
  const maxStart = addDays(today, HORIZON_DAYS_MAX - days);
  let start = currentMonday();
  if (q.start && /^\d{4}-\d{2}-\d{2}$/.test(q.start)) {
    const req = new Date(`${q.start}T00:00:00Z`);
    if (!Number.isNaN(req.getTime())) start = new Date(Math.min(Math.max(req.getTime(), minStart.getTime()), maxStart.getTime()));
  }
  const end = addDays(start, days - 1);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const dateKeys = dates.map((d) => d.toISOString().slice(0, 10));

  const allRoomTypes = await prisma.roomType.findMany({ where: { propertyId }, orderBy: { sortOrder: "asc" } });
  const visible = new Set((q.rows && q.rows.length > 0 ? q.rows : ["sold", "minlos", "ctd", "stopsell"]));
  const roomTypes = q.rt && q.rt.length > 0 ? allRoomTypes.filter((r) => q.rt!.includes(r.code)) : allRoomTypes;

  if (allRoomTypes.length === 0) {
    return {
      property, allRoomTypes, sections: [], dates: dateKeys, days, start: dateKeys[0] ?? "",
      visible: [...visible], currency: property.baseCurrency,
      ratePlanOptions: [] as { value: string; label: string }[], selectedRp: [] as string[],
      capabilityNotes: [] as { name: string; missing: string[] }[],
    };
  }

  const standard =
    (await prisma.ratePlan.findFirst({ where: { propertyId, code: "BAR" } })) ??
    (await prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual" }, orderBy: { sortOrder: "asc" } }));
  // Named rate-plan multi-select (spec §3.2): the user picks exactly which rate rows appear,
  // globally across room types. Governs RATE rows only — inventory + restriction rows stay pinned.
  const allPlans = await prisma.ratePlan.findMany({ where: { propertyId, active: true }, orderBy: { sortOrder: "asc" } });
  const defaultRp = [standard?.code, "NR", "BRF"].filter(Boolean) as string[]; // today's behaviour
  const selectedRp = new Set(q.rp && q.rp.length > 0 ? q.rp : defaultRp);
  // Grid (spec §2.2): rate rows — standard + derived — are shown purely by the Rates multi-select.
  // Month keeps its historical shape: the standard row only, no derived rows.
  const rateMode = q.rateRows ?? "grid";
  const derived = rateMode === "grid"
    ? allPlans.filter((p) => p.priceLogic === "derived" && selectedRp.has(p.code))
    : [];
  const showStandardRow = rateMode === "grid" ? (standard != null && selectedRp.has(standard.code)) : standard != null;

  const rtIds = roomTypes.map((r) => r.id);
  const [prices, cells, resLines] = await Promise.all([
    standard
      ? prisma.ratePrice.findMany({ where: { roomTypeId: { in: rtIds }, ratePlanId: standard.id, date: { gte: start, lte: end } } })
      : Promise.resolve([]),
    prisma.dailyCell.findMany({ where: { roomTypeId: { in: rtIds }, date: { gte: start, lte: end } } }),
    prisma.reservationLine.findMany({
      where: {
        roomTypeId: { in: rtIds },
        reservation: { propertyId, status: { in: [...SOLD_STATUSES] } },
        checkIn: { lte: end },
        checkOut: { gt: start },
      },
    }),
  ]);

  const priceKey = (rt: string, k: string) => `${rt}:${k}`;
  const priceMap = new Map(prices.map((p) => [priceKey(p.roomTypeId, p.date.toISOString().slice(0, 10)), p.priceMinor]));
  const cellMap = new Map(cells.map((c) => [priceKey(c.roomTypeId, c.date.toISOString().slice(0, 10)), c]));

  const fmt = (m: number | undefined) => (m === undefined ? "—" : (m / 100).toLocaleString("en-US"));
  const todayStr = today.toISOString().slice(0, 10);
  const apWindow = { min: standard?.defAdvancePurchaseMin ?? null, max: standard?.defAdvancePurchaseMax ?? null };

  const sections = roomTypes.map((roomType) => {
    const rows: CalendarRow[] = [];
    const cellFor = (k: string) => cellMap.get(priceKey(roomType.id, k));

    rows.push({
      key: "inventory", label: "Rooms to sell", kind: "availability", field: "inventory", editable: true,
      cells: dateKeys.map((k) => {
        const inv = cellFor(k)?.inventory ?? roomType.totalRooms;
        // Total-rooms safety net (spec): loading more than the physical count saves, but warns.
        const over = inv > roomType.totalRooms;
        return {
          date: k, value: String(inv),
          ...(over ? { warn: `Attention: ${inv} to sell, but only ${roomType.totalRooms} physical ${roomType.unitKind === "bed" ? "beds" : "rooms"} exist` } : {}),
        };
      }),
    });
    if (visible.has("sold")) {
      rows.push({
        key: "sold", label: "Rooms sold", kind: "availability", muted: true,
        cells: dates.map((d, i) => {
          const sold = resLines.filter((l) => l.roomTypeId === roomType.id && l.checkIn <= d && d < l.checkOut).reduce((s2, l) => s2 + l.quantity, 0);
          return { date: dateKeys[i]!, value: String(sold), muted: true };
        }),
      });
    }
    if (showStandardRow) {
      rows.push({
        key: "standard", label: standard?.name ?? "Standard Rate", kind: "price", field: "price", editable: true,
        cells: dateKeys.map((k) => ({ date: k, value: fmt(priceMap.get(priceKey(roomType.id, k))) })),
      });
    }
    for (const dp of derived) {
      const cfg: DerivedRateConfig = {
        parentRatePlanId: standard?.id ?? "",
        adjustmentType: (dp.derivedType as "percent" | "fixed") ?? "percent",
        direction: (dp.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: dp.derivedValue ?? 0,
        rounding: (dp.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
        ...(dp.derivedFloorMinor != null ? { floorMinor: dp.derivedFloorMinor } : {}),
        ...(dp.derivedCeilingMinor != null ? { ceilingMinor: dp.derivedCeilingMinor } : {}),
      };
      const off = dp.derivedType === "percent"
        ? `${dp.derivedDirection === "increase" ? "+" : "−"}${dp.derivedValue}%`
        : `${dp.derivedDirection === "increase" ? "+" : "−"}€${((dp.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
      rows.push({
        key: dp.code, label: dp.name, kind: "price", muted: true,
        derived: { parent: standard?.name ?? "Standard Rate", offset: off }, // paperclip + hover (spec §2.3)
        cells: dateKeys.map((k) => {
          const parent = priceMap.get(priceKey(roomType.id, k));
          return { date: k, value: parent === undefined ? "—" : fmt(deriveRate(parent, cfg)), muted: true };
        }),
      });
    }
    if (visible.has("minlos")) {
      rows.push({
        key: "minlos", label: "Min LOS", kind: "restriction", field: "minLos", editable: true,
        cells: dateKeys.map((k) => {
          const los = cellFor(k)?.minLos ?? standard?.defMinLos ?? null;
          return { date: k, value: los ? String(los) : "—" };
        }),
      });
    }
    if (visible.has("cta")) {
      rows.push({
        key: "cta", label: "CTA", kind: "flag", field: "cta", editable: true,
        cells: dateKeys.map((k) => {
          const on = cellFor(k)?.cta ?? false;
          return { date: k, value: on ? "✕" : "·", ...(on ? { flag: "cta" as const } : {}) };
        }),
      });
    }
    if (visible.has("ctd")) {
      rows.push({
        key: "ctd", label: "CTD", kind: "flag", field: "ctd", editable: true,
        cells: dateKeys.map((k) => {
          const on = cellFor(k)?.ctd ?? false;
          return { date: k, value: on ? "✕" : "·", ...(on ? { flag: "ctd" as const } : {}) };
        }),
      });
    }
    if (visible.has("stopsell")) {
      rows.push({
        key: "stopsell", label: "Stop Sell", kind: "flag", field: "stopSell", editable: true,
        cells: dateKeys.map((k) => {
          const on = (cellFor(k)?.stopSell ?? false) || isAdvancePurchaseClosed(todayStr, k, apWindow);
          return { date: k, value: on ? "●" : "·", ...(on ? { flag: "stop" as const } : {}) };
        }),
      });
    }
    return { roomType: { id: roomType.id, name: roomType.name, code: roomType.code, totalRooms: roomType.totalRooms, unitKind: roomType.unitKind }, rows };
  });

  // Capability legend (spec §5.2): channels that ignore some restriction types — shown as a
  // limitation note, never as an error.
  const chans = await prisma.channel.findMany({ where: { propertyId, status: "connected" }, select: { name: true, supportedRestrictions: true } });
  const CAP_LABEL: Record<string, string> = { cta: "CTA", ctd: "CTD", min_los: "Min LOS", max_los: "Max LOS", advance_purchase_min: "Adv. purchase min", advance_purchase_max: "Adv. purchase max", stop_sell: "Stop sell" };
  const capabilityNotes = chans
    .map((c) => ({ name: c.name, missing: unsupportedRestrictions(c.supportedRestrictions).filter((x) => x !== "channel_allocation").map((x) => CAP_LABEL[x] ?? x) }))
    .filter((c) => c.missing.length > 0);

  return {
    property, allRoomTypes, sections, dates: dateKeys, days, start: dateKeys[0]!, visible: [...visible],
    currency: property.baseCurrency,
    ratePlanOptions: allPlans.map((p) => ({ value: p.code, label: p.priceLogic === "derived" ? `${p.name} (derived)` : p.name })),
    selectedRp: [...selectedRp],
    capabilityNotes,
  };
}

export type ReservationDateType = "check_in" | "check_out" | "created" | "cancelled" | "stay";

export interface ReservationFilters {
  channels?: string[]; // channel codes, multi — empty ⇒ all (spec: cross-filtering)
  status?: string;
  q?: string;          // guest name, or comma-separated booking numbers
  from?: string;       // range start (YYYY-MM-DD)
  to?: string;         // range end
  dateType?: ReservationDateType; // which date the from→to range applies to (default check-in)
}

export async function getReservations(filters: ReservationFilters = {}) {
  const property = await getProperty();
  const where: Record<string, unknown> = { propertyId: property.id };
  if (filters.channels && filters.channels.length > 0) where.channel = { code: { in: filters.channels } };
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    // Multiple reservation numbers, comma-separated (spec) — else guest-or-number contains.
    const tokens = filters.q.split(",").map((s) => s.trim()).filter(Boolean);
    where.OR =
      tokens.length > 1
        ? [{ externalId: { in: tokens } }, { id: { in: tokens } }]
        : [
            { guestName: { contains: filters.q, mode: "insensitive" } },
            { externalId: { contains: filters.q } },
          ];
  }
  if (filters.from || filters.to) {
    // Date-type filter (spec §3.7): which date the from→to range applies to. R1/R2 inclusive;
    // stay-in is an OVERLAP with strict > on departure (checkout day is not a stayed night).
    const type: ReservationDateType = filters.dateType ?? "check_in";
    const R1 = filters.from ? new Date(`${filters.from}T00:00:00Z`) : undefined;
    const R2 = filters.to ? new Date(`${filters.to}T00:00:00Z`) : undefined;
    const R2end = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined; // inclusive for timestamps
    if (type === "check_in") {
      where.lines = { some: { checkIn: { ...(R1 ? { gte: R1 } : {}), ...(R2 ? { lte: R2 } : {}) } } };
    } else if (type === "check_out") {
      where.lines = { some: { checkOut: { ...(R1 ? { gte: R1 } : {}), ...(R2 ? { lte: R2 } : {}) } } };
    } else if (type === "created") {
      // The "pickup" lens — when the booking reached us (Channex receipt / core creation).
      where.importedAt = { ...(R1 ? { gte: R1 } : {}), ...(R2end ? { lte: R2end } : {}) };
    } else if (type === "cancelled") {
      // Only cancelled reservations carry this date — auto-scope so an empty result isn't a "bug".
      where.cancelledAt = { ...(R1 ? { gte: R1 } : {}), ...(R2end ? { lte: R2end } : {}) };
      if (!filters.status) where.status = "cancelled";
    } else if (type === "stay") {
      // In-house on any night of the range: arrival <= R2 AND departure > R1.
      where.lines = { some: { ...(R2 ? { checkIn: { lte: R2 } } : {}), ...(R1 ? { checkOut: { gt: R1 } } : {}) } };
    }
  }
  return prisma.reservation.findMany({
    where: where as never,
    include: { channel: true, lines: { include: { roomType: true, ratePlan: true } } },
    orderBy: { importedAt: "desc" },
    take: 200,
  });
}

export async function getRoomsAndRates() {
  const property = await getProperty();
  const [roomTypes, ratePlans] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId: property.id }, orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      include: { cancellationPolicy: true, mealPlan: true, parent: true, _count: { select: { roomTypeLinks: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { property, roomTypes, ratePlans };
}

/**
 * Dashboard Reservation Summary (spec §1.1): new vs cancelled reservations counted by ACTION date
 * (made / cancelled), NOT stay date — the same date basis as the Reservations "Date type" filter.
 * Both Today and Yesterday are precomputed so the card's toggle flips instantly with no refetch.
 */
export async function getReservationSummary() {
  const property = await getProperty();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  // "Made" date = importedAt (when the reservation entered the system); cancelled = cancelledAt.
  const count = (field: "importedAt" | "cancelledAt", from: Date, to: Date) =>
    prisma.reservation.count({ where: { propertyId: property.id, [field]: { gte: from, lt: to } } });
  const [newToday, newYesterday, cancToday, cancYesterday] = await Promise.all([
    count("importedAt", todayStart, tomorrowStart),
    count("importedAt", yesterdayStart, todayStart),
    count("cancelledAt", todayStart, tomorrowStart),
    count("cancelledAt", yesterdayStart, todayStart),
  ]);
  return {
    newRes: { today: newToday, yesterday: newYesterday },
    cancelled: { today: cancToday, yesterday: cancYesterday },
  };
}

export async function getChannels() {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  // Two-stream completeness: every room type AND every rate plan must be mapped to the channel.
  const [totalRoomTypes, totalRatePlans] = await Promise.all([
    prisma.roomType.count({ where: { propertyId: property.id } }),
    prisma.ratePlan.count({ where: { propertyId: property.id } }),
  ]);
  const total = totalRoomTypes + totalRatePlans;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mapStats = await Promise.all(
    channels.map(async (c) => {
      const [rt, rp, syncs, syncsOk] = await Promise.all([
        prisma.channelRoomTypeMapping.count({ where: { channelId: c.id, status: "complete" } }),
        prisma.channelRatePlanMapping.count({ where: { channelId: c.id, status: "complete" } }),
        prisma.syncEvent.count({ where: { channelId: c.id, createdAt: { gte: since24h } } }),
        prisma.syncEvent.count({ where: { channelId: c.id, createdAt: { gte: since24h }, status: "success" } }),
      ]);
      return {
        channelId: c.id,
        complete: rt + rp,
        total,
        // Last-24h connectivity health: % of this channel's sync events that succeeded (null = no activity).
        health24h: syncs > 0 ? Math.round((syncsOk / syncs) * 100) : null,
        syncs24h: syncs,
      };
    }),
  );
  return { property, channels, mapStats };
}

export async function getRestrictions() {
  const property = await getProperty();
  const [rules, roomTypes, channels] = await Promise.all([
    prisma.restrictionRule.findMany({ where: { propertyId: property.id }, orderBy: [{ active: "desc" }, { priority: "desc" }] }),
    prisma.roomType.findMany({ where: { propertyId: property.id }, orderBy: { sortOrder: "asc" } }),
    prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } }),
  ]);
  // Attach a readable room-type name to each rule.
  const rtName = new Map(roomTypes.map((r) => [r.id, r.name]));
  const withNames = rules.map((r) => ({ ...r, roomTypeName: r.roomTypeId ? rtName.get(r.roomTypeId) ?? "—" : "All rooms" }));
  return { property, rules: withNames, roomTypes, channels };
}

function loadRoomTypeMappings(channelId: string) {
  return prisma.channelRoomTypeMapping.findMany({
    where: { channelId }, include: { roomType: true }, orderBy: { roomType: { sortOrder: "asc" } },
  });
}
function loadRatePlanMappings(channelId: string) {
  return prisma.channelRatePlanMapping.findMany({
    where: { channelId }, include: { ratePlan: true }, orderBy: { ratePlan: { sortOrder: "asc" } },
  });
}

export async function getMapping(channelCode?: string) {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  // No channels connected yet — return nothing to map; the page shows a CTA.
  if (channels.length === 0) {
    return {
      property, channels, channel: null,
      roomTypeMappings: [] as Awaited<ReturnType<typeof loadRoomTypeMappings>>,
      ratePlanMappings: [] as Awaited<ReturnType<typeof loadRatePlanMappings>>,
    };
  }
  const channel = channels.find((c) => c.code === channelCode) ?? channels[0]!;
  const [roomTypeMappings, ratePlanMappings] = await Promise.all([
    loadRoomTypeMappings(channel.id),
    loadRatePlanMappings(channel.id),
  ]);
  return { property, channels, channel, roomTypeMappings, ratePlanMappings };
}

export async function getSettings() {
  const property = await getProperty();
  const [users, properties, roomAgg] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
    prisma.roomType.aggregate({ where: { propertyId: property.id, active: true }, _sum: { totalRooms: true } }),
  ]);
  return { property, users, properties, totalRooms: roomAgg._sum.totalRooms ?? 0 };
}

/** Options for the "simulate a booking" dialog. */
export async function getBookingOptions() {
  const property = await getProperty();
  const [channels, roomTypes, ratePlans] = await Promise.all([
    prisma.channel.findMany({ where: { propertyId: property.id, status: "connected" }, orderBy: { name: "asc" } }),
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  // Simulate-booking is a DEMO affordance (spec §3.2): hidden the moment any channel runs real
  // connectivity, so it can never appear in a production tenant.
  const demoMode = channels.every((c) => c.connectivityMode === "mock");
  return { property, channels, roomTypes, ratePlans, demoMode };
}


/** Unresolved unmapped-product errors for one channel, each pointed at the mapping row to fix
 * (spec §3.6: an unmapped-booking alert deep-links to the exact row). */
export async function getUnmappedBookingAlerts(channelId: string) {
  const property = await getProperty();
  const errors = await prisma.errorItem.findMany({
    where: { propertyId: property.id, channelId, resolved: false, code: { contains: "not_mapped" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (errors.length === 0) return [];
  const [roomMaps, rateMaps] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId }, include: { roomType: true } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId }, include: { ratePlan: true } }),
  ]);
  return errors.map((e) => {
    const hay = `${e.message} ${e.productLabel ?? ""}`;
    const room = roomMaps.find((m) => hay.includes(m.roomType.name));
    const rate = rateMaps.find((m) => hay.includes(m.ratePlan.name));
    const anchor = rate ? `map-rate-${rate.id}` : room ? `map-room-${room.id}` : null;
    return { id: e.id, message: e.message, anchor };
  });
}
