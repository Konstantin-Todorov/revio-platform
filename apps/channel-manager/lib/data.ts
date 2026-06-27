import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { deriveRate, isAdvancePurchaseClosed, type DerivedRateConfig } from "@revio/core";
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
  if (!session) redirect("/login");
  return prisma.property.findUniqueOrThrow({
    where: { id: session.activePropertyId },
    include: { tenant: true },
  });
}

export async function getDashboard() {
  const property = await getProperty();
  const propertyId = property.id;

  const [channels, ratePlanLinks, mappings, reservations, syncEvents, errorItems, dailyStopSells] =
    await Promise.all([
      prisma.channel.findMany({ where: { propertyId }, orderBy: { name: "asc" } }),
      prisma.ratePlanRoomType.count({ where: { ratePlan: { propertyId, active: true } } }),
      prisma.productMapping.count({ where: { roomType: { propertyId }, status: { not: "complete" } } }),
      prisma.reservation.findMany({
        where: { propertyId },
        include: { channel: true, lines: { include: { roomType: true } } },
        orderBy: { importedAt: "desc" },
        take: 6,
      }),
      prisma.syncEvent.findMany({ where: { propertyId }, include: { channel: true }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.errorItem.findMany({ where: { propertyId, resolved: false }, include: { channel: true } }),
      prisma.dailyCell.count({ where: { propertyId, stopSell: true } }),
    ]);

  const connected = channels.filter((c) => c.status === "connected").length;
  const pending = channels.reduce((s, c) => s + c.pendingCount, 0);
  const failed = channels.reduce((s, c) => s + c.errorCount, 0);
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
      failedSyncs: failed,
      lastSync,
      stopSold: dailyStopSells,
      currencyWarnings,
    },
    channels,
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
  field?: "inventory" | "price" | "minLos" | "ctd" | "stopSell";
  editable?: boolean;
  cells: { date: string; value: string; flag?: "stop" | "ctd" | "cta"; muted?: boolean }[];
};

export async function getCalendar(roomTypeCode?: string, days = 7) {
  const property = await getProperty();
  const propertyId = property.id;

  const roomTypes = await prisma.roomType.findMany({ where: { propertyId }, orderBy: { sortOrder: "asc" } });
  const start = currentMonday();
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));

  // Empty hotel (no room types yet) — return a calendar with nothing to render; the page shows a CTA.
  if (roomTypes.length === 0) {
    return { property, roomTypes, roomType: null, dates: dates.map((d) => d.toISOString().slice(0, 10)), rows: [], currency: property.baseCurrency };
  }

  const roomType = roomTypes.find((r) => r.code === roomTypeCode) ?? roomTypes[0]!;
  const end = addDays(start, days - 1);

  // The base manual rate plan (prefer "BAR", else the first manual plan). May be absent on a new hotel.
  const standard =
    (await prisma.ratePlan.findFirst({ where: { propertyId, code: "BAR" } })) ??
    (await prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual" }, orderBy: { sortOrder: "asc" } }));
  const derived = await prisma.ratePlan.findMany({
    where: { propertyId, priceLogic: "derived", code: { in: ["NR", "BRF"] } },
    orderBy: { sortOrder: "asc" },
  });

  const [prices, cells, resLines] = await Promise.all([
    standard
      ? prisma.ratePrice.findMany({ where: { roomTypeId: roomType.id, ratePlanId: standard.id, date: { gte: start, lte: end } } })
      : Promise.resolve([]),
    prisma.dailyCell.findMany({ where: { roomTypeId: roomType.id, date: { gte: start, lte: end } } }),
    // Active reservation lines overlapping the window → "rooms sold" per date (derived).
    prisma.reservationLine.findMany({
      where: {
        roomTypeId: roomType.id,
        reservation: { propertyId, status: { in: ["confirmed", "modified", "overbooked"] } },
        checkIn: { lte: end },
        checkOut: { gt: start },
      },
    }),
  ]);

  const priceByDate = new Map(prices.map((p) => [p.date.toISOString().slice(0, 10), p.priceMinor]));
  const cellByDate = new Map(cells.map((c) => [c.date.toISOString().slice(0, 10), c]));
  const soldByDate = new Map(
    dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      const sold = resLines.filter((l) => l.checkIn <= d && d < l.checkOut).reduce((s, l) => s + l.quantity, 0);
      return [k, sold] as const;
    }),
  );

  const cur = property.baseCurrency;
  const fmt = (m: number | undefined) => (m === undefined ? "—" : (m / 100).toLocaleString("en-US"));

  const rows: CalendarRow[] = [];

  // "Rooms to sell" = the per-date allotment (defaults to physical Total Rooms). Editable.
  rows.push({
    key: "inventory", label: "Rooms to sell", kind: "availability", field: "inventory", editable: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      const inv = cellByDate.get(k)?.inventory ?? roomType.totalRooms;
      return { date: k, value: String(inv) };
    }),
  });
  // "Rooms sold" = derived from confirmed reservations. Read-only (bookable = to-sell − sold).
  rows.push({
    key: "sold", label: "Rooms sold", kind: "availability", muted: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      return { date: k, value: String(soldByDate.get(k) ?? 0), muted: true };
    }),
  });

  rows.push({
    key: "standard", label: "Standard Rate", kind: "price", field: "price", editable: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      return { date: k, value: fmt(priceByDate.get(k)) };
    }),
  });

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
    rows.push({
      key: dp.code, label: dp.name, kind: "price", muted: true,
      cells: dates.map((d) => {
        const k = d.toISOString().slice(0, 10);
        const parent = priceByDate.get(k);
        return { date: k, value: parent === undefined ? "—" : fmt(deriveRate(parent, cfg)), muted: true };
      }),
    });
  }

  // Rate-plan-level restrictions on the standard plan: Min LOS falls back to the plan default; the
  // advance-purchase window auto-closes near/far dates (rolling, computed live in @revio/core).
  const today = utcDate(new Date()).toISOString().slice(0, 10);
  const apWindow = { min: standard?.defAdvancePurchaseMin ?? null, max: standard?.defAdvancePurchaseMax ?? null };

  rows.push({
    key: "minlos", label: "Min LOS", kind: "restriction", field: "minLos", editable: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      const los = cellByDate.get(k)?.minLos ?? standard?.defMinLos ?? null;
      return { date: k, value: los ? String(los) : "—" };
    }),
  });
  rows.push({
    key: "ctd", label: "CTD", kind: "flag", field: "ctd", editable: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      const on = cellByDate.get(k)?.ctd ?? false;
      return { date: k, value: on ? "✕" : "·", ...(on ? { flag: "ctd" as const } : {}) };
    }),
  });
  rows.push({
    key: "stopsell", label: "Stop Sell", kind: "flag", field: "stopSell", editable: true,
    cells: dates.map((d) => {
      const k = d.toISOString().slice(0, 10);
      // Manual stop-sell OR an advance-purchase rolling auto-close on the standard plan.
      const on = (cellByDate.get(k)?.stopSell ?? false) || isAdvancePurchaseClosed(today, k, apWindow);
      return { date: k, value: on ? "●" : "·", ...(on ? { flag: "stop" as const } : {}) };
    }),
  });

  return { property, roomTypes, roomType, dates: dates.map((d) => d.toISOString().slice(0, 10)), rows, currency: cur };
}

export async function getReservations() {
  const property = await getProperty();
  return prisma.reservation.findMany({
    where: { propertyId: property.id },
    include: { channel: true, lines: { include: { roomType: true, ratePlan: true } } },
    orderBy: { importedAt: "desc" },
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

export async function getChannels() {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  const totalProducts = await prisma.ratePlanRoomType.count({ where: { ratePlan: { propertyId: property.id } } });
  const mapStats = await Promise.all(
    channels.map(async (c) => {
      const complete = await prisma.productMapping.count({ where: { channelId: c.id, status: "complete" } });
      return { channelId: c.id, complete, total: totalProducts };
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

export async function getMapping(channelCode?: string) {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } });
  // No channels connected yet — return nothing to map; the page shows a CTA.
  if (channels.length === 0) {
    return { property, channels, channel: null, mappings: [] as Awaited<ReturnType<typeof getMappingRows>> };
  }
  const channel = channels.find((c) => c.code === channelCode) ?? channels[0]!;
  const mappings = await getMappingRows(channel.id);
  return { property, channels, channel, mappings };
}

function getMappingRows(channelId: string) {
  return prisma.productMapping.findMany({
    where: { channelId },
    include: { roomType: true, ratePlan: true },
    orderBy: [{ roomType: { sortOrder: "asc" } }, { ratePlan: { sortOrder: "asc" } }],
  });
}

export async function getSettings() {
  const property = await getProperty();
  const [users, properties] = await Promise.all([
    prisma.user.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
  ]);
  return { property, users, properties };
}

/** Options for the "simulate a booking" dialog. */
export async function getBookingOptions() {
  const property = await getProperty();
  const [channels, roomTypes, ratePlans] = await Promise.all([
    prisma.channel.findMany({ where: { propertyId: property.id, status: "connected" }, orderBy: { name: "asc" } }),
    prisma.roomType.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findMany({ where: { propertyId: property.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { property, channels, roomTypes, ratePlans };
}
