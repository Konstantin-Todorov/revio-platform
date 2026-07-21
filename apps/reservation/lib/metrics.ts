import "server-only";
import {
  adrMinor, averageLeadTimeDays, averageLosNights, cancellationRatePct,
  cancelledRoomNightRatePct, expandInventoryPeriods, nightsInRange, occupancyPct,
  pickup as pickupOf, revparMinor, soldStatusesFor, stayNights, stayTotals,
  type DateRange, type MetricLine,
} from "@revio/core";
import { prisma } from "./db";
import { addDays, getProperty, getScope, todayInTz, ymd } from "./data";

/**
 * Assembles DB records into the @revio/core formula sheet's inputs. Dashboard and every report
 * read THIS module — the numbers can never disagree because there is only one computation.
 */

// Spec §3.1: Custom, L7D, L28D, YTD, N7D, N28D, Today, Tomorrow. 28 = four whole weeks so
// week-over-week / year-over-year comparisons aren't distorted by day-of-week mismatch —
// do NOT "tidy" this back to 30. (Legacy keys 7d/30d/mtd still resolve for old links.)
export type RangePreset = "today" | "tomorrow" | "l7d" | "l28d" | "ytd" | "n7d" | "n28d" | "custom";

export interface ResolvedRange extends DateRange {
  preset: RangePreset;
  label: string;
  days: number;
  /** Past ranges are ACTUALS (realized); future ranges are ON-THE-BOOKS (confirmed only) —
   * the labels must shift accordingly (spec §3.1). */
  kind: "past" | "future" | "mixed";
}

export function resolveRange(todayIso: string, preset?: string, from?: string, to?: string): ResolvedRange {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const mk = (p: RangePreset, start: string, endExcl: string, label: string, kind: ResolvedRange["kind"]): ResolvedRange => ({
    preset: p, start, endExcl, label, kind,
    days: Math.max(1, Math.round((new Date(`${endExcl}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000)),
  });
  switch (preset) {
    case "tomorrow": return mk("tomorrow", ymd(addDays(today, 1)), ymd(addDays(today, 2)), "Tomorrow", "future");
    case "l7d": return mk("l7d", ymd(addDays(today, -7)), todayIso, "Last 7 days", "past");
    case "l28d": return mk("l28d", ymd(addDays(today, -28)), todayIso, "Last 28 days", "past");
    case "n7d": case "7d": return mk("n7d", todayIso, ymd(addDays(today, 7)), "Next 7 days", "future");
    case "n28d": case "30d": return mk("n28d", todayIso, ymd(addDays(today, 28)), "Next 28 days", "future");
    case "mtd": return mk("ytd", `${todayIso.slice(0, 8)}01`, ymd(addDays(today, 1)), "Month to date", "past");
    case "ytd": return mk("ytd", `${todayIso.slice(0, 4)}-01-01`, ymd(addDays(today, 1)), "Year to date", "past");
    case "custom": {
      if (from && to && iso.test(from) && iso.test(to) && to >= from) {
        const endExcl = ymd(addDays(new Date(`${to}T00:00:00Z`), 1));
        const kind = endExcl <= ymd(addDays(today, 1)) ? "past" : from >= todayIso ? "future" : "mixed";
        const r = mk("custom", from, endExcl, `${from} → ${to}`, kind);
        if (r.days <= 366) return r;
      }
      return mk("today", todayIso, ymd(addDays(today, 1)), "Today", "past");
    }
    default: return mk("today", todayIso, ymd(addDays(today, 1)), "Today", "past");
  }
}

/** Same time last year = 364 DAYS BACK (52 whole weeks), not 365 — the shift preserves
 * day-of-week so a Saturday compares to a Saturday (spec §4.2, the STLY standard). */
export function stlyRange(range: ResolvedRange): ResolvedRange {
  const shift = (isoDate: string) => ymd(addDays(new Date(`${isoDate}T00:00:00Z`), -364));
  return { ...range, start: shift(range.start), endExcl: shift(range.endExcl), label: `${range.label} · STLY` };
}

/** Dashboard/Analytics comparison baseline (CRS-REFINEMENT-R2 §1.2): YoY = 364 days back (STLY,
 * weekday-aligned — NOT 365); LW = 7 days back (day-of-week aligned automatically). */
export type CompareBasis = "yoy" | "lw";
export function comparisonRange(range: ResolvedRange, basis: CompareBasis): ResolvedRange {
  const back = basis === "lw" ? 7 : 364;
  const shift = (isoDate: string) => ymd(addDays(new Date(`${isoDate}T00:00:00Z`), -back));
  return { ...range, start: shift(range.start), endExcl: shift(range.endExcl), label: `${range.label} · ${basis === "lw" ? "LW" : "STLY"}` };
}

interface LoadedLine extends MetricLine {
  reservationId: string;
  guestName: string;
  roomTypeName: string;
  sourceName: string;
  importedAt: Date;
}

/** Everything a range needs, loaded once: capacity per day + normalized stay lines. Scope-aware —
 * in portfolio (group) scope it sums capacity and lines across EVERY property in the tenant so the
 * cards can recompute ratios from summed numerators/denominators (never averaged). */
async function loadRange(range: DateRange) {
  const { propertyIds, primary } = await getScope();
  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.endExcl}T00:00:00Z`);

  const [defaults, roomTypes, periods, rawLines] = await Promise.all([
    prisma.propertyDefaults.findUnique({ where: { propertyId: primary.id } }),
    prisma.roomType.findMany({ where: { propertyId: { in: propertyIds }, active: true } }),
    prisma.roomInventoryPeriod.findMany({ where: { propertyId: { in: propertyIds }, dateFrom: { lt: end }, dateTo: { gte: start } } }),
    prisma.reservationLine.findMany({
      where: { checkIn: { lt: end }, checkOut: { gt: start }, reservation: { propertyId: { in: propertyIds } } },
      include: {
        roomType: { select: { name: true } },
        reservation: {
          select: {
            id: true, status: true, guestName: true, importedAt: true, cancelledAt: true,
            channel: { select: { name: true, commissionPct: true, bookingSource: { select: { name: true } } } },
            bookingSource: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const physical = roomTypes.reduce((s, rt) => s + rt.totalRooms, 0);
  const dates: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) dates.push(ymd(new Date(t)));

  // Capacity = physical − OOO − closed (the manual rooms-to-sell cap is a sales lever, not capacity).
  // In group scope this MUST be clamped per property (max(0, …) before summing) so one hotel's
  // closures can never erase another's rooms — group available room-nights = Σ over properties.
  const physicalByProp = new Map<string, number>();
  for (const rt of roomTypes) physicalByProp.set(rt.propertyId, (physicalByProp.get(rt.propertyId) ?? 0) + rt.totalRooms);
  const periodsByProp = new Map<string, typeof periods>();
  for (const p of periods) {
    const arr = periodsByProp.get(p.propertyId) ?? [];
    arr.push(p);
    periodsByProp.set(p.propertyId, arr);
  }
  const availableByDate = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const pid of propertyIds) {
    const phys = physicalByProp.get(pid) ?? 0;
    const byDate = expandInventoryPeriods(
      (periodsByProp.get(pid) ?? []).map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms })),
      dates,
    );
    for (const d of dates) {
      const { outOfOrder, closed } = byDate.get(d)!;
      availableByDate.set(d, availableByDate.get(d)! + Math.max(0, phys - outOfOrder - closed));
    }
  }

  const lines: LoadedLine[] = rawLines.map((l) => ({
    reservationId: l.reservation.id,
    status: l.reservation.status,
    quantity: l.quantity,
    checkIn: ymd(l.checkIn),
    checkOut: ymd(l.checkOut),
    priceMinor: l.priceMinor ?? null,
    commissionPct: l.reservation.channel?.commissionPct ?? 0,
    guestName: l.reservation.guestName,
    roomTypeName: l.roomType.name,
    sourceName:
      l.reservation.bookingSource?.name ?? l.reservation.channel?.bookingSource?.name ?? l.reservation.channel?.name ?? "Direct",
    importedAt: l.reservation.importedAt,
  }));

  return { property: primary, defaults, dates, availableByDate, lines, physical, propertyIds };
}

export interface MetricCards {
  occupancyPct: number;
  roomsSoldNights: number;
  availableRoomNights: number;
  revenueMinor: number; // gross or net per the property's display setting
  revenueDisplay: "gross" | "net";
  adrMinor: number;
  revparMinor: number;
  cancellationRatePct: number;
  cancelledCount: number;
  createdCount: number;
  avgLosNights: number;
  avgLeadDays: number;
  pickup: { value: number; vsDate: string | null };
}

export async function getRangeMetrics(range: ResolvedRange) {
  const { property, defaults, dates, availableByDate, lines, propertyIds } = await loadRange(range);
  const countNoShows = defaults?.countNoShowsAsSold ?? true;
  const revenueDisplay = (defaults?.revenueDisplay === "net" ? "net" : "gross") as "gross" | "net";
  const todayIso = todayInTz(property.timezone);

  const availableRoomNights = dates.reduce((s, d) => s + (availableByDate.get(d) ?? 0), 0);
  const totals = stayTotals(lines, range, { countNoShows });

  // Per-day series (charts + Performance report).
  const soldSet = new Set(soldStatusesFor(countNoShows));
  const perDay = dates.map((d) => {
    const dayRange: DateRange = { start: d, endExcl: ymd(addDays(new Date(`${d}T00:00:00Z`), 1)) };
    const t = stayTotals(lines, dayRange, { countNoShows });
    const available = availableByDate.get(d) ?? 0;
    return {
      date: d,
      available,
      soldNights: t.roomsSoldNights,
      revenueMinor: revenueDisplay === "net" ? t.netRevenueMinor : t.roomRevenueMinor,
      occupancyPct: occupancyPct(t.roomsSoldNights, available),
    };
  });

  // Cancellation headline: of reservations CREATED in the range, how many stand cancelled now.
  const startD = new Date(`${range.start}T00:00:00Z`);
  const endD = new Date(`${range.endExcl}T00:00:00Z`);
  const [createdCount, cancelledCount] = await Promise.all([
    prisma.reservation.count({ where: { propertyId: { in: propertyIds }, importedAt: { gte: startD, lt: endD } } }),
    prisma.reservation.count({ where: { propertyId: { in: propertyIds }, importedAt: { gte: startD, lt: endD }, status: "cancelled" } }),
  ]);

  // LOS + lead time over reservations whose stay touches the range (sold only).
  const byReservation = new Map<string, { nights: number; importedAt: Date; checkIn: string }>();
  for (const l of lines) {
    if (!soldSet.has(l.status)) continue;
    const prev = byReservation.get(l.reservationId);
    const nights = l.quantity * stayNights(l.checkIn, l.checkOut);
    if (prev) {
      prev.nights += nights;
      if (l.checkIn < prev.checkIn) prev.checkIn = l.checkIn;
    } else {
      byReservation.set(l.reservationId, { nights, importedAt: l.importedAt, checkIn: l.checkIn });
    }
  }
  const resAgg = [...byReservation.values()];
  const avgLos = averageLosNights(resAgg.reduce((s, r) => s + r.nights, 0), resAgg.length);
  const avgLead = averageLeadTimeDays(resAgg.map((r) => [r.importedAt.toISOString(), r.checkIn]));

  const pickup = await getPickup(propertyIds, todayIso, defaults?.pickupOffsetDays ?? 7, countNoShows);

  const cards: MetricCards = {
    occupancyPct: occupancyPct(totals.roomsSoldNights, availableRoomNights),
    roomsSoldNights: totals.roomsSoldNights,
    availableRoomNights,
    revenueMinor: revenueDisplay === "net" ? totals.netRevenueMinor : totals.roomRevenueMinor,
    revenueDisplay,
    adrMinor: adrMinor(totals.roomRevenueMinor, totals.roomsSoldNights),
    revparMinor: revparMinor(totals.roomRevenueMinor, availableRoomNights),
    cancellationRatePct: cancellationRatePct(cancelledCount, createdCount),
    cancelledCount,
    createdCount,
    avgLosNights: avgLos,
    avgLeadDays: avgLead,
    pickup,
  };

  // Source mix (reservations + room-nights + revenue share).
  const mix = new Map<string, { reservations: Set<string>; roomNights: number; revenueMinor: number }>();
  for (const l of lines) {
    if (!soldSet.has(l.status)) continue;
    const entry = mix.get(l.sourceName) ?? { reservations: new Set(), roomNights: 0, revenueMinor: 0 };
    const inRange = nightsInRange(l.checkIn, l.checkOut, range);
    if (inRange === 0) continue;
    entry.reservations.add(l.reservationId);
    entry.roomNights += l.quantity * inRange;
    const total = stayNights(l.checkIn, l.checkOut);
    if (l.priceMinor != null && total > 0) entry.revenueMinor += Math.round((l.priceMinor * inRange) / total);
    mix.set(l.sourceName, entry);
  }
  const mixTotalRevenue = [...mix.values()].reduce((s, m) => s + m.revenueMinor, 0);
  const sourceMix = [...mix.entries()]
    .map(([name, m]) => ({
      name,
      reservations: m.reservations.size,
      roomNights: m.roomNights,
      revenueMinor: m.revenueMinor,
      sharePct: mixTotalRevenue > 0 ? (m.revenueMinor / mixTotalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenueMinor - a.revenueMinor);

  return { property, defaults, range, cards, perDay, sourceMix, todayIso };
}

/** Pickup vs the snapshot ~offset days back (or the earliest we have — snapshots started Phase 1).
 * Scope-aware: in group scope it sums pickup across every property (snapshots are taken on the same
 * dates for all of them, so the aggregate over `snapshotDate` is directly comparable). */
async function getPickup(propertyIds: string[], todayIso: string, offsetDays: number, countNoShows: boolean) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const horizonEnd = addDays(today, 30);
  const wanted = ymd(addDays(today, -offsetDays));

  const candidate =
    (await prisma.pickupSnapshot.findFirst({
      where: { propertyId: { in: propertyIds }, snapshotDate: { lte: new Date(`${wanted}T00:00:00Z`) } },
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true },
    })) ??
    (await prisma.pickupSnapshot.findFirst({
      where: { propertyId: { in: propertyIds } },
      orderBy: { snapshotDate: "asc" },
      select: { snapshotDate: true },
    }));
  if (!candidate) return { value: 0, vsDate: null };

  const [snapAgg, lines] = await Promise.all([
    prisma.pickupSnapshot.aggregate({
      _sum: { roomsSold: true },
      where: { propertyId: { in: propertyIds }, snapshotDate: candidate.snapshotDate, targetDate: { gte: today, lt: horizonEnd } },
    }),
    prisma.reservationLine.findMany({
      where: {
        checkIn: { lt: horizonEnd }, checkOut: { gt: today },
        reservation: { propertyId: { in: propertyIds }, status: { in: soldStatusesFor(countNoShows) } },
      },
      select: { quantity: true, checkIn: true, checkOut: true },
    }),
  ]);
  const range: DateRange = { start: todayIso, endExcl: ymd(horizonEnd) };
  const soldNow = lines.reduce((s, l) => s + l.quantity * nightsInRange(ymd(l.checkIn), ymd(l.checkOut), range), 0);
  return { value: pickupOf(soldNow, snapAgg._sum.roomsSold ?? 0), vsDate: ymd(candidate.snapshotDate) };
}

/** Forecast = the same formulas read forward (docs/CRS-REFERENCE.md — NOT AI). */
export async function getForecast(todayIso: string, days: 7 | 30) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const range: ResolvedRange = {
    preset: "custom", start: todayIso, endExcl: ymd(addDays(today, days)), label: `Next ${days} days`, days, kind: "future",
  };
  const { defaults, dates, availableByDate, lines } = await loadRange(range);
  const countNoShows = defaults?.countNoShowsAsSold ?? true;
  const totals = stayTotals(lines, range, { countNoShows });
  const available = dates.reduce((s, d) => s + (availableByDate.get(d) ?? 0), 0);
  const soldSet = new Set(soldStatusesFor(countNoShows));
  const arrivals = new Set(lines.filter((l) => soldSet.has(l.status) && l.checkIn >= range.start && l.checkIn < range.endExcl).map((l) => l.reservationId)).size;
  const departures = new Set(lines.filter((l) => soldSet.has(l.status) && l.checkOut > range.start && l.checkOut <= range.endExcl).map((l) => l.reservationId)).size;
  return {
    days,
    occupancyPct: occupancyPct(totals.roomsSoldNights, available),
    roomsSoldNights: totals.roomsSoldNights,
    revenueMinor: (defaults?.revenueDisplay === "net" ? totals.netRevenueMinor : totals.roomRevenueMinor),
    arrivals,
    departures,
  };
}

/** Operational lists + Action Center for the Dashboard (property-timezone "today"). */
export async function getOperations() {
  const property = await getProperty();
  const propertyId = property.id;
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId } });
  const todayIso = todayInTz(property.timezone);
  const today = new Date(`${todayIso}T00:00:00Z`);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const soldSet = soldStatusesFor(defaults?.countNoShowsAsSold ?? true);

  const [arrivals, departures, newRes, cancelledRes, failedSyncs24h, openErrors] = await Promise.all([
    prisma.reservationLine.findMany({
      where: { checkIn: today, reservation: { propertyId, status: { in: soldSet } } },
      include: { roomType: { select: { name: true } }, reservation: { select: { id: true, guestName: true } } },
      orderBy: { reservation: { guestName: "asc" } },
    }),
    prisma.reservationLine.findMany({
      where: { checkOut: today, reservation: { propertyId, status: { in: soldSet } } },
      include: { roomType: { select: { name: true } }, reservation: { select: { id: true, guestName: true } } },
      orderBy: { reservation: { guestName: "asc" } },
    }),
    prisma.reservation.findMany({
      where: { propertyId, importedAt: { gte: dayAgo } },
      include: { lines: { include: { roomType: { select: { name: true } } } } },
      orderBy: { importedAt: "desc" }, take: 6,
    }),
    prisma.reservation.findMany({
      where: { propertyId, status: "cancelled", OR: [{ cancelledAt: { gte: dayAgo } }, { importedAt: { gte: dayAgo } }] },
      include: { lines: { include: { roomType: { select: { name: true } } } } },
      orderBy: { importedAt: "desc" }, take: 6,
    }),
    prisma.syncEvent.count({ where: { propertyId, status: "failed", createdAt: { gte: dayAgo } } }),
    prisma.errorItem.count({ where: { propertyId, resolved: false } }),
  ]);

  return { property, defaults, todayIso, arrivals, departures, newRes, cancelledRes, failedSyncs24h, openErrors };
}

export interface ActionAlert {
  severity: "critical" | "warning" | "info";
  message: string;
  href: string;
}

/** Action Center — prioritized alerts; every threshold comes from PropertyDefaults (a Setting). */
export function buildActionAlerts(args: {
  board: { sections: { roomType: { name: string }; cells: { remaining: number }[] }[]; dates: string[] };
  threshold: number;
  failedSyncs24h: number;
  openErrors: number;
}): ActionAlert[] {
  const alerts: ActionAlert[] = [];
  for (const section of args.board.sections) {
    section.cells.forEach((cell, i) => {
      const date = args.board.dates[i]!;
      if (cell.remaining < 0) {
        alerts.push({ severity: "critical", message: `${section.roomType.name} is OVERBOOKED by ${-cell.remaining} on ${date}`, href: `/inventory?start=${date}&days=7` });
      } else if (cell.remaining === 0) {
        alerts.push({ severity: "warning", message: `${section.roomType.name} sells out on ${date}`, href: `/inventory?start=${date}&days=7` });
      } else if (cell.remaining <= args.threshold) {
        alerts.push({ severity: "info", message: `${section.roomType.name}: only ${cell.remaining} left on ${date}`, href: `/inventory?start=${date}&days=7` });
      }
    });
  }
  if (args.failedSyncs24h > 0) alerts.push({ severity: "critical", message: `${args.failedSyncs24h} failed sync${args.failedSyncs24h === 1 ? "" : "s"} in the last 24h`, href: "/inventory" });
  if (args.openErrors > 0) alerts.push({ severity: "warning", message: `${args.openErrors} unresolved error${args.openErrors === 1 ? "" : "s"} need attention`, href: "/inventory" });
  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 10);
}

// --- Reports -----------------------------------------------------------------

export async function getPickupReport() {
  const { propertyIds, primary: property } = await getScope();
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const todayIso = todayInTz(property.timezone);
  const today = new Date(`${todayIso}T00:00:00Z`);
  const horizonEnd = addDays(today, 30);
  const countNoShows = defaults?.countNoShowsAsSold ?? true;
  const wanted = ymd(addDays(today, -(defaults?.pickupOffsetDays ?? 7)));

  const candidate =
    (await prisma.pickupSnapshot.findFirst({
      where: { propertyId: { in: propertyIds }, snapshotDate: { lte: new Date(`${wanted}T00:00:00Z`) } },
      orderBy: { snapshotDate: "desc" }, select: { snapshotDate: true },
    })) ??
    (await prisma.pickupSnapshot.findFirst({ where: { propertyId: { in: propertyIds } }, orderBy: { snapshotDate: "asc" }, select: { snapshotDate: true } }));

  const [snapRows, lines] = await Promise.all([
    candidate
      ? prisma.pickupSnapshot.groupBy({
          by: ["targetDate"],
          _sum: { roomsSold: true },
          where: { propertyId: { in: propertyIds }, snapshotDate: candidate.snapshotDate, targetDate: { gte: today, lt: horizonEnd } },
        })
      : Promise.resolve([]),
    prisma.reservationLine.findMany({
      where: { checkIn: { lt: horizonEnd }, checkOut: { gt: today }, reservation: { propertyId: { in: propertyIds }, status: { in: soldStatusesFor(countNoShows) } } },
      select: { quantity: true, checkIn: true, checkOut: true },
    }),
  ]);
  const snapByDate = new Map(snapRows.map((r) => [ymd(r.targetDate), r._sum.roomsSold ?? 0]));

  const rows = [];
  for (let t = today.getTime(); t < horizonEnd.getTime(); t += 86_400_000) {
    const d = ymd(new Date(t));
    const soldNow = lines.filter((l) => ymd(l.checkIn) <= d && ymd(l.checkOut) > d).reduce((s, l) => s + l.quantity, 0);
    const soldAtSnap = snapByDate.get(d) ?? 0;
    rows.push({ date: d, soldNow, soldAtSnap, pickup: soldNow - soldAtSnap });
  }
  return { property, rows, vsDate: candidate ? ymd(candidate.snapshotDate) : null, todayIso };
}

export async function getCancellationReport(range: ResolvedRange) {
  const { propertyIds, primary: property } = await getScope();
  const startD = new Date(`${range.start}T00:00:00Z`);
  const endD = new Date(`${range.endExcl}T00:00:00Z`);
  const created = await prisma.reservation.findMany({
    where: { propertyId: { in: propertyIds }, importedAt: { gte: startD, lt: endD } },
    include: { lines: { include: { roomType: { select: { name: true } } } }, channel: { select: { name: true } }, bookingSource: { select: { name: true } } },
    orderBy: { importedAt: "desc" },
  });
  const cancelled = created.filter((r) => r.status === "cancelled");
  const nightsOf = (r: (typeof created)[number]) => r.lines.reduce((s, l) => s + l.quantity * stayNights(ymd(l.checkIn), ymd(l.checkOut)), 0);
  const grossNights = created.reduce((s, r) => s + nightsOf(r), 0);
  const cancelledNights = cancelled.reduce((s, r) => s + nightsOf(r), 0);
  return {
    property,
    cancelled,
    headlineRatePct: cancellationRatePct(cancelled.length, created.length),
    roomNightRatePct: cancelledRoomNightRatePct(cancelledNights, grossNights),
    createdCount: created.length,
    cancelledNights,
    grossNights,
  };
}


/** Room-type & rate-plan performance (spec §3.2): nights, revenue, ADR per product.
 * lens "stay" = clipped to nights falling in the range (occupancy view); lens "book" =
 * reservations MADE in the range, whole stays (production view). */
export async function getProductPerformance(range: ResolvedRange, lens: "stay" | "book") {
  const { propertyIds, primary: property } = await getScope();
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const countNoShows = defaults?.countNoShowsAsSold ?? true;
  const soldSet = new Set(soldStatusesFor(countNoShows));
  const start = new Date(`${range.start}T00:00:00Z`);
  const endExcl = new Date(`${range.endExcl}T00:00:00Z`);

  const lines = await prisma.reservationLine.findMany({
    where: {
      reservation: {
        propertyId: { in: propertyIds },
        ...(lens === "book" ? { importedAt: { gte: start, lt: endExcl } } : {}),
      },
      ...(lens === "stay" ? { checkIn: { lt: endExcl }, checkOut: { gt: start } } : {}),
    },
    include: { reservation: { select: { status: true, importedAt: true } }, roomType: true, ratePlan: true },
  });

  type Row = { name: string; reservations: Set<string>; nights: number; revenueMinor: number };
  const byRoom = new Map<string, Row>();
  const byPlan = new Map<string, Row>();
  for (const l of lines) {
    if (!soldSet.has(l.reservation.status)) continue;
    const totalNights = Math.max(1, Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000));
    const nights = lens === "stay" ? nightsInRange(l.checkIn.toISOString().slice(0, 10), l.checkOut.toISOString().slice(0, 10), range) * l.quantity : totalNights * l.quantity;
    if (nights <= 0) continue;
    // Revenue prorated per night for the stay lens; whole line for the book lens.
    const lineRevenue = l.priceMinor ?? 0;
    const revenue = lens === "stay" ? Math.round(lineRevenue * (nights / (totalNights * l.quantity || 1))) : lineRevenue;
    for (const [map, key] of [[byRoom, l.roomType.name], [byPlan, l.ratePlan.name]] as const) {
      const row = map.get(key) ?? { name: key, reservations: new Set<string>(), nights: 0, revenueMinor: 0 };
      row.reservations.add(l.reservationId);
      row.nights += nights;
      row.revenueMinor += revenue;
      map.set(key, row);
    }
  }
  const finish = (m: Map<string, Row>) =>
    [...m.values()]
      .map((r) => ({ name: r.name, reservations: r.reservations.size, nights: r.nights, revenueMinor: r.revenueMinor, adrMinor: r.nights > 0 ? Math.round(r.revenueMinor / r.nights) : 0 }))
      .sort((a, b) => b.revenueMinor - a.revenueMinor);
  return { property, roomTypes: finish(byRoom), ratePlans: finish(byPlan) };
}

/** Production by creation day (the book-date lens for Performance): what was BOOKED each day
 * of the range, regardless of when the stays fall (spec §3.2 global Book/Stay toggle). */
export async function getProductionByDay(range: ResolvedRange) {
  const { propertyIds, primary: property } = await getScope();
  const start = new Date(`${range.start}T00:00:00Z`);
  const endExcl = new Date(`${range.endExcl}T00:00:00Z`);
  const reservations = await prisma.reservation.findMany({
    where: { propertyId: { in: propertyIds }, importedAt: { gte: start, lt: endExcl } },
    include: { lines: true },
  });
  const days = new Map<string, { bookings: number; nights: number; revenueMinor: number; cancelled: number }>();
  for (const r of reservations) {
    const key = r.importedAt.toISOString().slice(0, 10);
    const row = days.get(key) ?? { bookings: 0, nights: 0, revenueMinor: 0, cancelled: 0 };
    row.bookings += 1;
    if (r.status === "cancelled") row.cancelled += 1;
    else {
      row.nights += r.lines.reduce((s, l) => s + Math.max(1, Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000)) * l.quantity, 0);
      row.revenueMinor += r.propertyTotalMinor ?? r.totalMinor;
    }
    days.set(key, row);
  }
  const rows = [...days.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  const totals = rows.reduce(
    (s, r) => ({ bookings: s.bookings + r.bookings, nights: s.nights + r.nights, revenueMinor: s.revenueMinor + r.revenueMinor, cancelled: s.cancelled + r.cancelled }),
    { bookings: 0, nights: 0, revenueMinor: 0, cancelled: 0 },
  );
  return { property, rows, totals };
}
