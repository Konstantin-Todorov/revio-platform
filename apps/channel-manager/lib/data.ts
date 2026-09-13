import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { computeWaterfall, deriveRate, expandInventoryPeriods, isAdvancePurchaseClosed, ratePlanIdsToLoad, ratePlanRows, ROOM_OCCUPYING_STATUSES, unsupportedRestrictions, type DerivedRateConfig, type SetupFacts, type ProductName } from "@revio/core";
import { structureGap, describeStructureGap, mappingRows } from "@revio/connectivity";
import { getSession } from "./session";

const DAY = 86_400_000;
function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
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

  /*
   * Products that never reached the channel manager AT ALL — a different question from the two
   * counts above, and the reason they cannot answer it.
   *
   * Provisioning is one-shot, so a room type or rate plan added afterwards is created locally, made
   * sellable, and never sent. It therefore has no mapping row, and `status != complete` counts rows:
   * no row, no count, and the hotel is shown green while it sells a room no OTA can see.
   *
   * Only asked when a channel actually exists. A hotel that has not connected one yet is not
   * failing to sync anything, and warning it would be the same false signal in the other direction.
   */
  const channelCount = await prisma.channel.count({ where: { propertyId: property.id } });
  if (channelCount > 0) {
    const [roomTypes, ratePlans, roomRows, rateRows] = await Promise.all([
      prisma.roomType.findMany({ where: { propertyId: property.id }, select: { id: true, name: true, active: true } }),
      prisma.ratePlan.findMany({ where: { propertyId: property.id }, select: { id: true, name: true, active: true, priceLogic: true } }),
      prisma.channelRoomTypeMapping.findMany({ where: { channel: { propertyId: property.id } }, select: { roomTypeId: true } }),
      prisma.channelRatePlanMapping.findMany({ where: { channel: { propertyId: property.id } }, select: { ratePlanId: true } }),
    ]);
    const gap = structureGap({
      roomTypes,
      ratePlans,
      mappedRoomTypeIds: roomRows.map((r) => r.roomTypeId),
      mappedRatePlanIds: rateRows.map((r) => r.ratePlanId),
    });
    const sentence = describeStructureGap(gap);
    if (sentence) items.push({ text: sentence, href: "/mapping", tone: "danger" });
  }

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

        /*
         * Occupancy counts toward mapping completeness — OBP §L5 / L9.
         *
         * "All mapped" must not show green while a per-person plan has no occupancy rows, because
         * that plan cannot price the guest counts it claims to sell. Everything else about it IS
         * mapped, which is exactly what makes the green misleading: the screen would be telling the
         * truth about room types and rate plans and the wrong thing overall.
         *
         * Counted only under per-person. A per-room plan has one row by definition and there is
         * nothing to be incomplete about.
         */
        const defaults = await prisma.propertyDefaults.findUnique({
          where: { propertyId }, select: { pricingModel: true },
        });
        if ((defaults?.pricingModel ?? "per_room") !== "per_person") return rt + rp;

        const plans = await prisma.ratePlan.findMany({
          where: { propertyId, active: true, pricingModel: { not: "per_room" } },
          select: {
            id: true,
            _count: { select: { occupancyOptions: true } },
            roomTypeLinks: { select: { roomType: { select: { maxGuests: true, active: true } } } },
          },
        });
        const allRooms = await prisma.roomType.findMany({
          where: { propertyId, active: true }, select: { maxGuests: true },
        });
        const unmappedOccupancy = plans.filter((pl) => {
          const rooms = pl.roomTypeLinks.map((l) => l.roomType).filter((r) => r.active);
          const caps = (rooms.length > 0 ? rooms : allRooms).map((r) => r.maxGuests);
          if (caps.length === 0) return false;
          // A per-person plan needs one row per occupancy up to the smallest cap it sells on.
          return pl._count.occupancyOptions < Math.min(...caps);
        }).length;

        return rt + rp + unmappedOccupancy;
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
  const [failed24h, oldestPending, attempts24h, lastSuccessEvent] = await Promise.all([
    prisma.syncEvent.count({ where: { propertyId, status: "failed", createdAt: { gte: since24h } } }),
    prisma.syncEvent.findFirst({ where: { propertyId, status: "pending" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    // ATTEMPTS, not just failures. "0 failed" is only good news if something was tried — without
    // this the card cannot tell a clean 24 hours from a silent one, and renders both green.
    prisma.syncEvent.count({ where: { propertyId, kind: { in: ["push", "pull"] }, createdAt: { gte: since24h } } }),
    // The last SUCCESS, not the last attempt: a channel failing every five minutes has a very recent
    // attempt and is completely broken. `Channel.lastSyncAt` could not tell the two apart.
    prisma.syncEvent.findFirst({
      where: { propertyId, status: "success", kind: { in: ["push", "pull"] } },
      orderBy: { createdAt: "desc" }, select: { createdAt: true },
    }),
  ]);
  const failed = failed24h + errorItems.filter((e) => e.severity === "critical" && e.code !== "restriction_not_supported").length;
  // Real errors per channel for the Channel Status table (limitations excluded).
  const realErrorsByChannel = new Map<string, number>();
  for (const e of errorItems) {
    if (e.code === "restriction_not_supported" || !e.channelId) continue;
    realErrorsByChannel.set(e.channelId, (realErrorsByChannel.get(e.channelId) ?? 0) + 1);
  }
  /*
   * The last SUCCESS, and nothing else.
   *
   * This used to fall back to `max(Channel.lastSyncAt)` when no success event existed — which
   * quietly reinstated the exact bug the query above was written to fix. `Channel.lastSyncAt` is
   * stamped BEFORE the result is read, so it is an ATTEMPT. A channel that has failed every five
   * minutes since it was connected and has never once succeeded has a very recent attempt, and the
   * fallback handed that to `syncRecencyHealth` — whose parameter is literally named
   * `lastSuccessAt` — which read it as "Live".
   *
   * Worse, the dashboard prints this value under the label **"Last Successful Sync"**, so the screen
   * stated something untrue rather than merely being optimistic.
   *
   * `null` is the honest answer, and it is a good one: `syncRecencyHealth(null)` returns
   * `idle`/"Never synced", which is what has actually happened. Safe to drop because SyncEvent rows
   * are never pruned — there is no retention job anywhere in the repo — so a property that has ever
   * succeeded still has the row proving it.
   */
  const lastSync = lastSuccessEvent?.createdAt ?? null;

  /*
   * Per-channel last success, for the Channel Status table, for the same reason.
   *
   * One grouped query rather than one per channel: a property with a dozen channels should not cost
   * a dozen round trips to answer a question the database can answer once.
   */
  const successByChannel = new Map<string, Date>();
  for (const g of await prisma.syncEvent.groupBy({
    by: ["channelId"],
    where: { propertyId, status: "success", kind: { in: ["push", "pull"] }, channelId: { not: null } },
    _max: { createdAt: true },
  })) {
    if (g.channelId && g._max.createdAt) successByChannel.set(g.channelId, g._max.createdAt);
  }
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
      /** Pushes + pulls tried in the last 24h. Zero attempts and zero failures are different facts. */
      syncAttempts24h: attempts24h,
      lastSync,
      stopSold: dailyStopSells,
      currencyWarnings,
    },
    channels,
    /** channelId → when that channel last SUCCEEDED. Absent means never, never means not healthy. */
    successByChannel,
    realErrorsByChannel,
    reservations,
    syncEvents,
    errorItems,
  };
}

/**
 * What this property's channel connection actually is, in the hotel's words. Shown in the sidebar
 * so nobody has to guess whether they are looking at live OTA traffic or a demonstration.
 */
export async function getConnectivityLabel(): Promise<string> {
  const property = await getProperty();
  const channels = await prisma.channel.findMany({
    where: { propertyId: property.id, status: { not: "disconnected" } },
    select: { connectivityMode: true },
  });
  if (channels.length === 0) return "No channels connected";
  const live = channels.filter((c) => c.connectivityMode === "channex_prod").length;
  const sandbox = channels.filter((c) => c.connectivityMode === "channex_sandbox").length;
  if (live === channels.length) return `Live · ${live} channel${live === 1 ? "" : "s"}`;
  if (live > 0) return `${live} live · ${channels.length - live} in test`;
  if (sandbox > 0) return "Test connection (sandbox)";
  return "Test connection · nothing is sent to the OTAs";
}

/** First-run facts for the setup checklist — see `reviolinkSetup` in @revio/core. */
export async function getSetupFacts(): Promise<SetupFacts> {
  const property = await getProperty();
  const propertyId = property.id;
  const [roomTypes, ratePlans, prices, channels, unmappedRt, unmappedRp, taxes, reservations] = await Promise.all([
    prisma.roomType.count({ where: { propertyId } }),
    prisma.ratePlan.count({ where: { propertyId } }),
    prisma.ratePrice.count({ where: { propertyId } }),
    prisma.channel.count({ where: { propertyId, status: { not: "disconnected" } } }),
    prisma.channelRoomTypeMapping.count({ where: { channel: { propertyId }, status: { not: "complete" } } }),
    prisma.channelRatePlanMapping.count({ where: { channel: { propertyId }, status: { not: "complete" } } }),
    prisma.taxFee.count({ where: { propertyId, active: true } }),
    prisma.reservation.count({ where: { propertyId } }),
  ]);
  return {
    roomTypes, ratePlans, hasRates: prices > 0, channels,
    mappingComplete: unmappedRt + unmappedRp === 0,
    units: 0, staff: 0, hasTaxes: taxes > 0, catalogItems: 0, reservations,
    alsoRuns: alsoRuns({
      channelManager: property.tenant.hasChannelManager,
      reservation: property.tenant.hasReservation,
      pms: property.tenant.hasPms,
    }),
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
  /**
   * Which rate plan a price row edits. ⚠️ Required now that the grid renders one row PER PLAN: an
   * edit used to be unambiguous because there was only ever one price row, and writing without it
   * is how a price lands on a plan the person was not looking at.
   */
  ratePlanId?: string;
  cells: { date: string; value: string; flag?: "stop" | "ctd" | "cta"; muted?: boolean; warn?: string }[];
};

/** Board query: window start (YYYY-MM-DD), window size, room-type filter, visible row groups. */
export interface CalendarQuery {
  start?: string;
  days?: number;
  rt?: string[];    // room-type codes to show (empty = all)
  rows?: string[];  // visible optional row groups (sold|minlos|cta|ctd|stopsell)
  rp?: string[];    // rate-plan codes whose rate rows show (spec §2.3 named multi-select; empty = every ACTIVE plan)
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
  /*
   * ⚠️ The grid begins at TODAY, not at the Monday of this week.
   *
   * `currentMonday()` meant that on a Friday the calendar opened with four columns nobody can sell —
   * reported on 2026-09-12 as BUG-009, with the grid starting 7 September on the 12th. Past columns
   * spend width on the screen that most needs it and invite edits to dates that cannot be booked.
   *
   * The month view is the one exception and keeps its 45-day allowance, because a month grid has to
   * be able to start at the 1st of the current month.
   */
  const monthMode = (q.rateRows ?? "grid") === "month";
  const minStart = monthMode ? addDays(today, -45) : today;
  const maxStart = addDays(today, HORIZON_DAYS_MAX - days);
  let start = today;
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

  /*
   * ⚠️ ONE ROW PER ACTIVE PLAN. This block used to read:
   *
   *     const standard = await prisma.ratePlan.findFirst({ where: { propertyId, code: "BAR" } })
   *
   * — the first plan whose code happened to be "BAR", **with no `active` filter**, and every price
   * on the grid was read from it. At a hotel that had switched BAR off and sold on two BB plans, the
   * calendar therefore showed exactly one row, and it was the dead one. See `ratePlanRows`.
   */
  const planRecords = await prisma.ratePlan.findMany({ where: { propertyId }, orderBy: { sortOrder: "asc" } });
  const planInputs = planRecords.map((p) => ({
    id: p.id, code: p.code, name: p.name, active: p.active,
    priceLogic: p.priceLogic, sortOrder: p.sortOrder, parentRatePlanId: p.parentRatePlanId,
  }));
  const allPlans = planRecords.filter((p) => p.active);
  const planById = new Map(planRecords.map((p) => [p.id, p]));

  // The month view keeps its historical shape: the first active plan only, so a 31-column grid does
  // not become three rows deep per room type.
  const rateMode = q.rateRows ?? "grid";
  const planView = ratePlanRows(planInputs, rateMode === "grid" ? q.rp : undefined);
  const planRows = rateMode === "grid" ? planView.rows : planView.rows.slice(0, 1);

  /*
   * Restriction defaults (Min LOS, advance purchase) still come from a single plan, because the
   * restriction rows are per ROOM, not per plan. It is now the first ACTIVE plan rather than
   * whichever row was called BAR — a switched-off plan must not supply the hotel's defaults.
   */
  const standard = allPlans[0] ?? null;

  const rtIds = roomTypes.map((r) => r.id);
  // Every plan on screen, plus the parents the derived ones are computed from.
  const pricePlanIds = ratePlanIdsToLoad(planRows, planInputs);
  const [prices, cells, planCells, resLines, invPeriods, activeHolds] = await Promise.all([
    pricePlanIds.length > 0
      /*
       * ⚠️ Occupancy-filtered, and keyed by PLAN as well as room and date.
       *
       * It used to read one plan's prices into a map keyed on (room, date). That is what made a
       * price written to BB Flex invisible on a grid reading Standard Rate — the row was not wrong,
       * it was reading a different plan's prices and correctly finding none.
       *
       * The occupancy filter is separate and still required: OBP gave RatePrice an occupancy
       * dimension, so a per-person room returns one row PER GUEST COUNT and a map would silently
       * keep whichever arrived last. The headline is the room's primary occupancy.
       */
      ? prisma.ratePrice.findMany({
          where: {
            roomTypeId: { in: rtIds }, ratePlanId: { in: pricePlanIds }, date: { gte: start, lte: end },
            occupancy: { in: allRoomTypes.map((rt) => rt.defaultOccupancy ?? rt.maxGuests) },
          },
        })
      : Promise.resolve([]),
    // ROOM-LEVEL read — the calendar has one row per room, so `cellMap` is keyed on room + date.
    // Plan-scoped cells must not enter it; they belong to the rate-plan rows, not these.
    prisma.dailyCell.findMany({ where: { roomTypeId: { in: rtIds }, date: { gte: start, lte: end }, ratePlanId: null } }),
    /*
     * ⚠️ Plan-scoped restriction cells — NOT to render, but so the grid can admit they exist.
     *
     * Bulk Update writes restrictions against the chosen plans when a hotel picks SOME of them
     * (`restrictionPlansFor`), and the restriction rows here are per ROOM and read `ratePlanId:
     * null`. Both halves are right on their own, and together they lose the edit: the apply reports
     * success, the data is stored correctly, and the calendar shows the room-level value as though
     * nothing had changed. That is the same shape as the rate-plan defect reported on 2026-09-12 —
     * a write targeting plan X and a render reading elsewhere — found while looking for more of it.
     *
     * Rendering a restriction row per plan is the full answer and a bigger change to this grid. Not
     * hiding it is the part that cannot wait: a cell that differs per plan says so.
     */
    prisma.dailyCell.findMany({
      where: { roomTypeId: { in: rtIds }, date: { gte: start, lte: end }, ratePlanId: { not: null } },
      select: { roomTypeId: true, date: true, minLos: true, cta: true, ctd: true, stopSell: true },
    }),
    prisma.reservationLine.findMany({
      where: {
        roomTypeId: { in: rtIds },
        reservation: { propertyId, status: { in: [...ROOM_OCCUPYING_STATUSES] } },
        checkIn: { lte: end },
        checkOut: { gt: start },
      },
    }),
    /*
     * Out-of-order and closure periods, and live holds.
     *
     * ⚠️ Loaded so the Bookable row can compute EXACTLY what the push computes. A grid that
     * subtracts only sold, while `syncRealChannels` also subtracts OOO, closures and holds, is a
     * screen and a channel disagreeing about the same night — which is the whole class of fault
     * this calendar keeps producing.
     */
    prisma.roomInventoryPeriod.findMany({
      where: { roomTypeId: { in: rtIds }, dateFrom: { lte: end }, dateTo: { gte: start } },
    }),
    prisma.hold.findMany({
      where: {
        roomTypeId: { in: rtIds }, status: "active", expiresAt: { gt: new Date() },
        checkIn: { lte: end }, checkOut: { gt: start },
      },
    }),
  ]);

  /*
   * Periods expanded per (room, date) once, rather than scanned inside the cell loop: a 30-day
   * window across six room types is 180 cells, and a linear scan of every period on each is the
   * quiet O(n²) that only shows itself on the largest hotel.
   */
  const periodsByRoom = new Map<string, Map<string, { outOfOrder: number; closed: number }>>();
  for (const rt of roomTypes) {
    periodsByRoom.set(
      rt.id,
      expandInventoryPeriods(
        invPeriods
          .filter((p) => p.roomTypeId === rt.id)
          .map((p) => ({
            kind: p.kind, rooms: p.rooms,
            dateFrom: p.dateFrom.toISOString().slice(0, 10),
            dateTo: p.dateTo.toISOString().slice(0, 10),
          })),
        dateKeys,
      ),
    );
  }

  const priceKey = (rt: string, k: string) => `${rt}:${k}`;
  // Narrowed above to each room's primary, so at most one row per (plan, room, date) reaches this map.
  const planPriceKey = (rp: string, rt: string, k: string) => `${rp}:${rt}:${k}`;
  const priceMap = new Map(
    prices.map((p) => [planPriceKey(p.ratePlanId, p.roomTypeId, p.date.toISOString().slice(0, 10)), p.priceMinor]),
  );
  const cellMap = new Map(cells.map((c) => [priceKey(c.roomTypeId, c.date.toISOString().slice(0, 10)), c]));
  /*
   * Which (room, date) cells carry a restriction set for SOME rate plans rather than for the room.
   * The row below cannot show the per-plan values, so it says that it cannot — rather than showing
   * the room-level value and implying nothing else is set.
   */
  const planScoped = new Set<string>();
  for (const c of planCells) {
    if (c.minLos != null || c.cta || c.ctd || c.stopSell) {
      planScoped.add(priceKey(c.roomTypeId, c.date.toISOString().slice(0, 10)));
    }
  }
  const perPlanNote = (rt: string, k: string) =>
    planScoped.has(priceKey(rt, k))
      ? "Some rate plans have their own restriction on this date — set in Bulk Update. This row shows the room's."
      : undefined;

  const fmt = (m: number | undefined) => (m === undefined ? "—" : (m / 100).toLocaleString("en-US"));
  const todayStr = today.toISOString().slice(0, 10);
  const apWindow = { min: standard?.defAdvancePurchaseMin ?? null, max: standard?.defAdvancePurchaseMax ?? null };

  const sections = roomTypes.map((roomType) => {
    const rows: CalendarRow[] = [];
    const cellFor = (k: string) => cellMap.get(priceKey(roomType.id, k));
    const periodsByDate = periodsByRoom.get(roomType.id) ?? new Map();

    rows.push({
      /*
       * ⚠️ "Allocation", not "Rooms to sell".
       *
       * The old label reads as "how many are currently for sale" — the NET — while the row holds
       * the gross number the hotel set. A tester spent a session concluding the system was
       * overbooking because 1 sold and 1 "to sell" looked like a contradiction (BUG-017, 13 Sept).
       * It was not: the net had already gone to the channel. Two words, two different facts, and
       * the grid now names both.
       */
      key: "inventory", label: "Allocation", kind: "availability", field: "inventory", editable: true,
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

    /*
     * ⚠️ BOOKABLE — the single most important number on an availability screen, and this grid did
     * not have it.
     *
     * Reported as BUG-017 on 13 Sept, and it is what made BUG-015 look like an overbooking: two
     * confirmed bookings landed, "Rooms sold" went to 1, "Rooms to sell" stayed at 1, and nothing
     * anywhere said the night was gone. It was gone — the push had already sent 0 — but the screen
     * could not show it, so a data fault and a display gap were indistinguishable from the UI.
     *
     * ⚠️ Computed with `computeWaterfall`, the SAME function the push uses, from the same inputs.
     * A second, simpler arithmetic here (allocation − sold) would drift from what the channel is
     * told the moment an out-of-order room or a live hold exists — a screen and a channel
     * disagreeing about one night, which is exactly the class of fault this calendar keeps
     * producing. One function, one answer.
     */
    rows.push({
      key: "bookable", label: "Bookable", kind: "availability",
      cells: dates.map((d, i) => {
        const k = dateKeys[i]!;
        const sold = resLines.filter((l) => l.roomTypeId === roomType.id && l.checkIn <= d && d < l.checkOut).reduce((s2, l) => s2 + l.quantity, 0);
        const held = activeHolds.filter((h) => h.roomTypeId === roomType.id && h.checkIn <= d && d < h.checkOut).reduce((s2, h) => s2 + h.quantity, 0);
        const { outOfOrder, closed } = periodsByDate.get(k) ?? { outOfOrder: 0, closed: 0 };
        const remaining = computeWaterfall({
          physical: roomType.totalRooms, outOfOrder, closed,
          manualSellLimit: cellFor(k)?.inventory ?? null,
          holds: held, confirmed: sold,
        }).remaining;
        const bookable = Math.max(0, remaining);
        return {
          date: k, value: String(bookable),
          // Nothing left is the fact a hotelier scans for. It gets the emphasis, not a muted grey.
          ...(bookable === 0 ? { warn: "Nothing left to sell on this date — the channel has been told 0" } : {}),
        };
      }),
    });
    /*
     * ⚠️ ONE ROW PER PLAN, EACH CARRYING ITS OWN NAME.
     *
     * This was a single row labelled with whatever plan the old `standard` lookup resolved to, plus
     * rows for plans DERIVED from it. A hotel with two independent manual plans — the ordinary case
     * — could not be represented at all: one of its plans was the grid, and the other did not exist
     * as far as any read surface was concerned.
     */
    for (const plan of planRows) {
      const rec = planById.get(plan.id);
      const own = (k: string) => priceMap.get(planPriceKey(plan.id, roomType.id, k));

      if (plan.priceLogic !== "derived" || !plan.parentRatePlanId) {
        rows.push({
          key: plan.code, label: plan.label, kind: "price", field: "price", editable: true,
          ratePlanId: plan.id,
          cells: dateKeys.map((k) => ({ date: k, value: fmt(own(k)) })),
        });
        continue;
      }

      const parent = planById.get(plan.parentRatePlanId);
      const cfg: DerivedRateConfig = {
        parentRatePlanId: plan.parentRatePlanId,
        adjustmentType: (rec?.derivedType as "percent" | "fixed") ?? "percent",
        direction: (rec?.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: rec?.derivedValue ?? 0,
        rounding: (rec?.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
        ...(rec?.derivedFloorMinor != null ? { floorMinor: rec.derivedFloorMinor } : {}),
        ...(rec?.derivedCeilingMinor != null ? { ceilingMinor: rec.derivedCeilingMinor } : {}),
      };
      const off = rec?.derivedType === "percent"
        ? `${rec?.derivedDirection === "increase" ? "+" : "−"}${rec?.derivedValue}%`
        : `${rec?.derivedDirection === "increase" ? "+" : "−"}€${((rec?.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
      rows.push({
        key: plan.code, label: plan.label, kind: "price", muted: true,
        ratePlanId: plan.id,
        derived: { parent: parent?.name ?? "its parent plan", offset: off }, // paperclip + hover (spec §2.3)
        cells: dateKeys.map((k) => {
          const base = priceMap.get(planPriceKey(plan.parentRatePlanId!, roomType.id, k));
          return { date: k, value: base === undefined ? "—" : fmt(deriveRate(base, cfg)), muted: true };
        }),
      });
    }
    if (visible.has("minlos")) {
      rows.push({
        key: "minlos", label: "Min LOS", kind: "restriction", field: "minLos", editable: true,
        cells: dateKeys.map((k) => {
          const los = cellFor(k)?.minLos ?? standard?.defMinLos ?? null;
          const note = perPlanNote(roomType.id, k);
          return { date: k, value: los ? String(los) : "—", ...(note ? { warn: note } : {}) };
        }),
      });
    }
    if (visible.has("cta")) {
      rows.push({
        key: "cta", label: "CTA", kind: "flag", field: "cta", editable: true,
        cells: dateKeys.map((k) => {
          const on = cellFor(k)?.cta ?? false;
          const note = perPlanNote(roomType.id, k);
          return { date: k, value: on ? "✕" : "·", ...(on ? { flag: "cta" as const } : {}), ...(note ? { warn: note } : {}) };
        }),
      });
    }
    if (visible.has("ctd")) {
      rows.push({
        key: "ctd", label: "CTD", kind: "flag", field: "ctd", editable: true,
        cells: dateKeys.map((k) => {
          const on = cellFor(k)?.ctd ?? false;
          const note = perPlanNote(roomType.id, k);
          return { date: k, value: on ? "✕" : "·", ...(on ? { flag: "ctd" as const } : {}), ...(note ? { warn: note } : {}) };
        }),
      });
    }
    if (visible.has("stopsell")) {
      rows.push({
        key: "stopsell", label: "Stop Sell", kind: "flag", field: "stopSell", editable: true,
        cells: dateKeys.map((k) => {
          const on = (cellFor(k)?.stopSell ?? false) || isAdvancePurchaseClosed(todayStr, k, apWindow);
          const note = perPlanNote(roomType.id, k);
          return { date: k, value: on ? "●" : "·", ...(on ? { flag: "stop" as const } : {}), ...(note ? { warn: note } : {}) };
        }),
      });
    }
    return { roomType: { id: roomType.id, name: roomType.name, code: roomType.code, totalRooms: roomType.totalRooms, unitKind: roomType.unitKind }, rows };
  });

  // Capability legend (spec §5.2): channels that ignore some restriction types — shown as a
  // limitation note, never as an error.
  const chans = await prisma.channel.findMany({
    where: { propertyId, status: "connected" },
    select: { name: true, supportedRestrictions: true, supportsOccupancy: true },
  });
  // Whether per-occupancy pricing is even in play — a per-room property has nothing to degrade.
  const obpOn = (await prisma.propertyDefaults.findUnique({
    where: { propertyId }, select: { pricingModel: true },
  }))?.pricingModel === "per_person";
  const CAP_LABEL: Record<string, string> = { cta: "CTA", ctd: "CTD", min_los: "Min LOS", max_los: "Max LOS", advance_purchase_min: "Adv. purchase min", advance_purchase_max: "Adv. purchase max", stop_sell: "Stop sell" };
  /*
   * Occupancy rides the existing limitations line (§6.7 / L6), rather than getting a banner of its
   * own. It is the same kind of caveat as "Agoda ignores CTD": a channel that cannot express
   * per-occupancy rates still sells — it just sells at the primary occupancy's price, which is
   * degradation, not failure. Putting it here means a hotelier reads all their channel caveats in
   * one place instead of learning this one from a booking at the wrong price.
   *
   * Only shown when the property actually prices per person; a per-room property has nothing to lose.
   */
  const capabilityNotes = chans
    .map((c) => ({
      name: c.name,
      missing: [
        ...unsupportedRestrictions(c.supportedRestrictions)
          .filter((x) => x !== "channel_allocation")
          .map((x) => CAP_LABEL[x] ?? x),
        ...(obpOn && !c.supportsOccupancy ? ["per-guest pricing (sells at your main guest count)"] : []),
      ],
    }))
    .filter((c) => c.missing.length > 0);

  return {
    property, allRoomTypes, sections, dates: dateKeys, days, start: dateKeys[0]!, visible: [...visible],
    currency: property.baseCurrency,
    // ⚠️ Options, selection and rows all come from ONE reconciliation, so the pill cannot say 3
    // while the list offers 2 and none is ticked. See `ratePlanRows`.
    ratePlanOptions: planView.options,
    selectedRp: planView.selected,
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
      // The linked rooms come along because a rate plan's NAME is not unique — "Best Available Rate"
      // usually exists once per room type, and a picker showing it twice is unusable.
      include: {
        cancellationPolicy: true, mealPlan: true, parent: true,
        roomTypeLinks: { include: { roomType: { select: { name: true } } } },
        _count: { select: { roomTypeLinks: true } },
      },
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
/**
 * One row per product on the Mapping screen — an existing mapping, or a product that has never been
 * sent to the channel at all. `id` is null for the second kind: there is no row to update yet, so
 * `updateStreamMapping` creates one from `productId`.
 */
export interface MappedRoomRow {
  id: string | null;
  productId: string;
  roomTypeId: string;
  roomType: { id: string; name: string };
  externalRoomId: string | null;
  status: string;
  unmapped: boolean;
}

export interface MappedRateRow {
  id: string | null;
  productId: string;
  ratePlanId: string;
  ratePlan: { id: string; name: string };
  externalRateId: string | null;
  status: string;
  unmapped: boolean;
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
      roomTypeMappings: [] as MappedRoomRow[],
      ratePlanMappings: [] as MappedRateRow[],
      neverSent: [] as ReturnType<typeof structureGap>["neverSent"],
    };
  }
  const channel = channels.find((c) => c.code === channelCode) ?? channels[0]!;
  const [existingRoomMaps, existingRateMaps, roomTypes, ratePlans] = await Promise.all([
    loadRoomTypeMappings(channel.id),
    loadRatePlanMappings(channel.id),
    prisma.roomType.findMany({ where: { propertyId: property.id }, select: { id: true, name: true, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      select: { id: true, name: true, active: true, priceLogic: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  /*
   * ⚠️ A ROW FOR EVERY ACTIVE PRODUCT, not only for products that already have a mapping row.
   *
   * This screen used to render `ChannelRatePlanMapping` / `ChannelRoomTypeMapping` rows — and those
   * are created once, by `provisionChannexProperty`, from whatever existed the moment the channel
   * was connected. Provisioning is ONE-SHOT (root CLAUDE.md), so every room type and rate plan added
   * afterwards had no row, and a screen that lists rows therefore could not show it.
   *
   * That is what a tester saw on 2026-09-12: a hotel with three room types and two live rate plans,
   * offered two room types to map and two rate-plan rows both naming a plan they had switched off
   * (BUG-010, BUG-011). Nothing was broken in the mapping WRITE — the products were simply invisible
   * because they had never been sent.
   *
   * The gap was already computed (`structureGap`) and shown as a small "N never sent" badge. A badge
   * is not a row you can act on. Every active product is now a row; the ones with no mapping yet say
   * so and can be mapped like any other.
   */
  /*
   * The decision itself lives in `@revio/connectivity` (`mappingRows`, 12 tests) rather than here —
   * it is the rule a tester reported against, and a rule inside a 900-line data function is one
   * nobody can check. This shapes its output back into the fields the screen already reads.
   */
  const roomTypeMappings: MappedRoomRow[] = mappingRows(
    roomTypes.map((rt) => ({ id: rt.id, name: rt.name, active: rt.active })),
    existingRoomMaps.map((m) => ({ id: m.id, productId: m.roomTypeId, externalId: m.externalRoomId, status: m.status })),
    "room",
  ).map((r) => ({
    id: r.id,
    productId: r.productId,
    roomTypeId: r.productId,
    roomType: { id: r.productId, name: r.name },
    externalRoomId: r.externalId,
    status: r.status,
    unmapped: r.unmapped,
  }));

  const ratePlanMappings: MappedRateRow[] = mappingRows(
    ratePlans.map((rp) => ({ id: rp.id, name: rp.name, active: rp.active, priceLogic: rp.priceLogic })),
    existingRateMaps.map((m) => ({ id: m.id, productId: m.ratePlanId, externalId: m.externalRateId, status: m.status })),
    "rate",
  ).map((r) => ({
    id: r.id,
    productId: r.productId,
    ratePlanId: r.productId,
    ratePlan: { id: r.productId, name: r.name },
    externalRateId: r.externalId,
    status: r.status,
    unmapped: r.unmapped,
  }));

  /*
   * "All mapped" was counting ROWS whose status is not `complete`, so a product that never reached
   * the channel at all — no row — made the count zero and the pill green. Provisioning is one-shot,
   * so that is every room type and rate plan added after setup. Asked separately here because it is
   * a different question: absence, not incompleteness.
   */
  const { neverSent } = structureGap({
    roomTypes,
    ratePlans,
    mappedRoomTypeIds: existingRoomMaps.map((m) => m.roomTypeId),
    mappedRatePlanIds: existingRateMaps.map((m) => m.ratePlanId),
  });

  return { property, channels, channel, roomTypeMappings, ratePlanMappings, neverSent };
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

/**
 * Which OTHER Revio products this hotel runs.
 *
 * Lets a shared step say where it was already done ("Already set up in RevioLink") instead of just
 * going quietly green. The entitlement is the right signal: a hotel that owns the product has seen
 * that screen, whether or not it has finished with it.
 */
function alsoRuns(e: { channelManager: boolean; reservation: boolean; pms: boolean }): ProductName[] {
  const all: [boolean, ProductName][] = [
    [e.channelManager, "RevioLink"],
    [e.reservation, "RevioCRS"],
    [e.pms, "RevioPMS"],
  ];
  return all.filter(([owned, name]) => owned && name !== "RevioLink").map(([, name]) => name);
}
