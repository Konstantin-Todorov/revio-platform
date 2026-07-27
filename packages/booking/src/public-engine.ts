/**
 * Booking-engine seam (docs/specs/BOOKING-ENGINE-ADDENDUM.md §6) — the two operations the future
 * public widget needs, callable WITHOUT a staff session: availability-search and reservation-create.
 *
 * The widget build itself is deferred; this module exists so the CRS design doesn't wall it out.
 * Functions are parameterized by a tenant-scoped Prisma client (the route resolves the property via
 * the system perimeter, then scopes with forTenant) — same pattern as @revio/connectivity/sync.ts.
 *
 * Boundaries honoured (addendum §3): reads the SAME availability waterfall and rate plans as staff
 * screens (no separate inventory); writes the ONE shared reservation record tagged source = Booking
 * Engine (category "direct"); bypasses RevioLink/Channex on the way in; only rate plans flagged
 * `directChannelEnabled` are exposed (selection, not mapping).
 */
import type { forTenant } from "@revio/db";
import {
  computeStayCharges, computeWaterfall, deriveRate, expandInventoryPeriods, isAdvancePurchaseClosed, resolveRestriction,
  SOLD_STATUSES, type DerivedRateConfig, type RestrictionRuleHit, type RestrictionType,
} from "@revio/core";
import { syncRealChannels } from "@revio/connectivity";

type Db = ReturnType<typeof forTenant>;
type PropertyRow = { id: string; tenantId: string; name: string; baseCurrency: string; timezone: string };

const DAY_MS = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (s: string) => new Date(`${s}T00:00:00Z`);

function todayInTz(tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA formats as YYYY-MM-DD
}

export interface PublicStayQuery {
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  guests: number;
}

export interface PublicPlanQuote {
  ratePlanId: string;
  name: string;
  code: string;
  /** Rooms only, for the whole stay. Shown as a line in the breakdown, never as the headline. */
  accommodationMinor: number;
  /** Taxes and fees the guest actually pays on top, itemised so nothing is a surprise. */
  charges: { name: string; amountMinor: number }[];
  /**
   * THE number. Everything included, for the whole stay.
   *
   * This is deliberately what the guest sees first: the most-cited reason people abandon a hotel
   * booking is a total that grows at checkout. Computed with the same @revio/core function the PMS
   * folio bills with, so the quote and the eventual bill cannot disagree.
   */
  totalMinor: number;
  /** Average per night, for comparison against an OTA's headline rate. Display only. */
  perNightMinor: number;
  currency: string;
  mealPlan: string | null;
  cancellationPolicy: string | null;
}

/** One photograph, already resized. Object KEYS — the caller turns them into URLs, because only the
 *  app knows whether a bucket origin or its own media route is serving them. */
export interface PublicRoomPhoto {
  fullKey: string;
  thumbKey: string;
  width: number;
  height: number;
  alt: string;
}

export interface PublicRoomOption {
  roomTypeId: string;
  name: string;
  code: string;
  maxGuests: number;
  remaining: number; // min remaining across the stay's nights
  /** Cover first (lowest sortOrder). Empty is normal and must render as a designed state, never
   *  as a broken card — a hotel can go live before its photo shoot. */
  photos: PublicRoomPhoto[];
  plans: PublicPlanQuote[];
}

function validStay(q: PublicStayQuery): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(q.checkOut)) return "Dates must be YYYY-MM-DD.";
  if (q.checkOut <= q.checkIn) return "Check-out must be after check-in.";
  if (!Number.isInteger(q.guests) || q.guests < 1 || q.guests > 12) return "Guests must be 1-12.";
  const nights = (utcDay(q.checkOut).getTime() - utcDay(q.checkIn).getTime()) / DAY_MS;
  if (nights > 30) return "Stays longer than 30 nights aren't bookable online.";
  return null;
}

/** Shared loader: everything needed to price + gate a stay window. */
async function loadStayContext(db: Db, property: PropertyRow, q: PublicStayQuery) {
  const start = utcDay(q.checkIn);
  const end = utcDay(q.checkOut); // exclusive
  const nights: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) nights.push(ymd(new Date(t)));

  const [roomTypes, plans, cells, prices, periods, holds, resLines, defaults, rules, fees] = await Promise.all([
    db.roomType.findMany({
      where: { propertyId: property.id, active: true },
      // Included rather than fetched per room: this is the guest's first paint, and a query per
      // room type is the difference between one round-trip and six.
      include: { photos: { orderBy: { sortOrder: "asc" }, take: 8 } },
      orderBy: { sortOrder: "asc" },
    }),
    db.ratePlan.findMany({
      where: { propertyId: property.id, active: true, directChannelEnabled: true },
      include: { roomTypeLinks: true, cancellationPolicy: true, mealPlan: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.dailyCell.findMany({ where: { propertyId: property.id, date: { gte: start, lt: end } } }),
    db.ratePrice.findMany({ where: { propertyId: property.id, date: { gte: start, lt: end } } }),
    db.roomInventoryPeriod.findMany({ where: { propertyId: property.id, dateFrom: { lt: end }, dateTo: { gte: start } } }),
    db.hold.findMany({ where: { propertyId: property.id, status: "active", expiresAt: { gt: new Date() }, checkIn: { lt: end }, checkOut: { gt: start } } }),
    db.reservationLine.findMany({
      where: { reservation: { propertyId: property.id, status: { in: [...SOLD_STATUSES] } }, checkIn: { lt: end }, checkOut: { gt: start } },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    }),
    db.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
    db.restrictionRule.findMany({ where: { propertyId: property.id, active: true, dateFrom: { lte: end }, dateTo: { gte: start } } }),
    db.taxFee.findMany({ where: { propertyId: property.id, active: true } }),
  ]);

  const cellOf = (rtId: string, k: string) => cells.find((c) => c.roomTypeId === rtId && ymd(c.date) === k);
  const priceMap = new Map(prices.map((p) => [`${p.roomTypeId}:${p.ratePlanId}:${ymd(p.date)}`, p.priceMinor]));

  const priceFor = (rtId: string, rp: (typeof plans)[number], k: string): number | null => {
    const direct = priceMap.get(`${rtId}:${rp.id}:${k}`);
    if (direct != null) return direct;
    if (rp.priceLogic === "derived" && rp.parentRatePlanId) {
      const parent = priceMap.get(`${rtId}:${rp.parentRatePlanId}:${k}`);
      if (parent == null) return null;
      const cfg: DerivedRateConfig = {
        parentRatePlanId: rp.parentRatePlanId,
        adjustmentType: (rp.derivedType as "percent" | "fixed") ?? "percent",
        direction: (rp.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: rp.derivedValue ?? 0,
        rounding: (rp.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
        ...(rp.derivedFloorMinor != null ? { floorMinor: rp.derivedFloorMinor } : {}),
        ...(rp.derivedCeilingMinor != null ? { ceilingMinor: rp.derivedCeilingMinor } : {}),
      };
      return deriveRate(parent, cfg);
    }
    return null;
  };

  // Direct-channel rule hits: rules with no source scope, or scoped to the "direct" category.
  const ruleHits = (type: string, rtId: string, rpId: string, k: string): RestrictionRuleHit[] =>
    rules
      .filter((r) =>
        r.type === type &&
        (r.roomTypeId == null || r.roomTypeId === rtId) &&
        (r.ratePlanId == null || r.ratePlanId === rpId) &&
        (r.sourceCategories.length === 0 || r.sourceCategories.includes("direct")) &&
        ymd(r.dateFrom) <= k && ymd(r.dateTo) >= k,
      )
      .map((r) => ({ priority: r.priority, value: (r.valueBool ?? r.valueInt ?? true) as number | boolean }));

  const remainingFor = (rtId: string, totalRooms: number): number => {
    let min = Number.MAX_SAFE_INTEGER;
    const rtPeriods = expandInventoryPeriods(
      periods.filter((p) => p.roomTypeId === rtId).map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms })),
      nights,
    );
    for (const k of nights) {
      const d = utcDay(k);
      const cell = cellOf(rtId, k);
      const sold = resLines.filter((l) => l.roomTypeId === rtId && l.checkIn <= d && d < l.checkOut).reduce((s, l) => s + l.quantity, 0);
      const held = holds.filter((h) => h.roomTypeId === rtId && h.checkIn <= d && d < h.checkOut).reduce((s, h) => s + h.quantity, 0);
      const { outOfOrder, closed } = rtPeriods.get(k)!;
      const rem = computeWaterfall({
        physical: totalRooms, outOfOrder, closed,
        manualSellLimit: cell?.inventory ?? null,
        holds: held, confirmed: sold,
      }).remaining;
      min = Math.min(min, rem);
    }
    return Math.max(0, min === Number.MAX_SAFE_INTEGER ? 0 : min);
  };

  /** Two-tier restriction gate for one (room type, plan) over the stay. Null = bookable. */
  const stayBlocked = (rtId: string, rp: (typeof plans)[number]): string | null => {
    const todayIso = todayInTz(property.timezone);
    const flag = (type: RestrictionType, k: string, cellV: boolean | undefined, planV: boolean, propV: boolean | undefined) =>
      Boolean(resolveRestriction(type, {
        ...(cellV ? { dateScoped: true } : {}),
        matchingRules: ruleHits(type, rtId, rp.id, k),
        ...(planV ? { ratePlanDefault: true } : {}),
        ...(propV ? { propertyDefault: true } : {}),
      }).value);
    const num = (type: RestrictionType, k: string, cellV: number | null | undefined, planV: number | null, propV: number | null | undefined) => {
      const r = resolveRestriction(type, {
        ...(cellV != null ? { dateScoped: cellV } : {}),
        matchingRules: ruleHits(type, rtId, rp.id, k),
        ...(planV != null ? { ratePlanDefault: planV } : {}),
        ...(propV != null ? { propertyDefault: propV } : {}),
      });
      return r.source === "none" ? null : Number(r.value);
    };
    for (const k of nights) {
      if (flag("stop_sell", k, cellOf(rtId, k)?.stopSell, rp.defStopSell, defaults?.defStopSell)) return "closed to sale";
    }
    const arrival = q.checkIn;
    if (flag("cta", arrival, cellOf(rtId, arrival)?.cta, rp.defCta, defaults?.defCta)) return "closed to arrival";
    const minLos = num("min_los", arrival, cellOf(rtId, arrival)?.minLos, rp.defMinLos, defaults?.defMinLos);
    if (minLos != null && nights.length < minLos) return `minimum stay ${minLos} nights`;
    const maxLos = num("max_los", arrival, cellOf(rtId, arrival)?.maxLos, rp.defMaxLos, defaults?.defMaxLos);
    if (maxLos != null && nights.length > maxLos) return `maximum stay ${maxLos} nights`;
    const apMin = num("advance_purchase_min", arrival, cellOf(rtId, arrival)?.advancePurchaseMin, rp.defAdvancePurchaseMin, defaults?.defAdvancePurchaseMin);
    const apMax = num("advance_purchase_max", arrival, cellOf(rtId, arrival)?.advancePurchaseMax, rp.defAdvancePurchaseMax, defaults?.defAdvancePurchaseMax);
    if (isAdvancePurchaseClosed(todayIso, arrival, { min: apMin, max: apMax })) return "advance-purchase window closed";
    return null;
  };

  return { nights, roomTypes, plans, priceFor, remainingFor, stayBlocked, fees, defaults };
}

/** GET /api/public/availability — the widget's search. */
export async function publicAvailability(db: Db, property: PropertyRow, q: PublicStayQuery): Promise<{ error?: string; options?: PublicRoomOption[] }> {
  const bad = validStay(q);
  if (bad) return { error: bad };
  const { nights, roomTypes, plans, priceFor, remainingFor, stayBlocked, fees, defaults } =
    await loadStayContext(db, property, q);
  const cityTaxIncluded = defaults?.cityTaxMode === "included";

  const options: PublicRoomOption[] = [];
  for (const rt of roomTypes) {
    if (rt.maxGuests < q.guests) continue;
    const remaining = remainingFor(rt.id, rt.totalRooms);
    if (remaining < 1) continue;
    const quotes: PublicPlanQuote[] = [];
    for (const rp of plans) {
      if (rp.roomTypeLinks.length > 0 && !rp.roomTypeLinks.some((l) => l.roomTypeId === rt.id)) continue;
      if (stayBlocked(rt.id, rp) != null) continue;
      let total = 0;
      let complete = true;
      for (const k of nights) {
        const p = priceFor(rt.id, rp, k);
        if (p == null) { complete = false; break; }
        total += p;
      }
      if (!complete) continue;
      // All-in from here on: the same fee engine the folio bills with, so this total is the
      // total — on this screen, at checkout, and on the bill at the hotel.
      const charged = computeStayCharges({
        stay: { accommodationMinor: total, nights: nights.length, rooms: 1, guests: q.guests },
        fees,
        cityTaxIncluded,
      });
      quotes.push({
        ratePlanId: rp.id, name: rp.name, code: rp.code,
        accommodationMinor: total,
        charges: charged.lines.map((l) => ({ name: l.name, amountMinor: l.amountMinor })),
        totalMinor: charged.totalMinor,
        perNightMinor: Math.round(charged.totalMinor / Math.max(1, nights.length)),
        currency: property.baseCurrency,
        mealPlan: rp.mealPlan?.name ?? null,
        cancellationPolicy: rp.cancellationPolicy?.name ?? null,
      });
    }
    if (quotes.length > 0) {
      options.push({
        roomTypeId: rt.id, name: rt.name, code: rt.code, maxGuests: rt.maxGuests, remaining,
        photos: rt.photos.map((ph) => ({
          fullKey: ph.fullKey, thumbKey: ph.thumbKey, width: ph.width, height: ph.height, alt: ph.alt,
        })),
        plans: quotes,
      });
    }
  }
  return { options };
}

export interface PublicBookingPayload extends PublicStayQuery {
  roomTypeId: string;
  ratePlanId: string;
  guest: { firstName: string; lastName: string; email: string; phone?: string };
}

/** POST /api/public/reservations — the widget's create. Writes the ONE shared reservation record. */
export async function publicCreateReservation(
  db: Db, property: PropertyRow, p: PublicBookingPayload,
): Promise<{
  error?: string;
  reservationId?: string;
  status?: string;
  /** Rooms only — what the reservation stores, and what room-revenue metrics are built on. */
  accommodationMinor?: number;
  /** All-in, including taxes and fees. THIS is what the guest owes and what we confirm back. */
  totalMinor?: number;
  charges?: { name: string; amountMinor: number }[];
  currency?: string;
}> {
  const bad = validStay(p);
  if (bad) return { error: bad };
  if (!p.guest?.firstName?.trim() || !p.guest?.lastName?.trim() || !/.+@.+\..+/.test(p.guest?.email ?? "")) {
    return { error: "Guest first name, last name and a valid email are required." };
  }
  const { nights, roomTypes, plans, priceFor, remainingFor, stayBlocked, fees, defaults } =
    await loadStayContext(db, property, p);
  const rt = roomTypes.find((r) => r.id === p.roomTypeId);
  const rp = plans.find((r) => r.id === p.ratePlanId);
  if (!rt || !rp) return { error: "Unknown room type or rate plan (or not bookable on the direct channel)." };
  if (rt.maxGuests < p.guests) return { error: `${rt.name} sleeps at most ${rt.maxGuests} guests.` };
  if (rp.roomTypeLinks.length > 0 && !rp.roomTypeLinks.some((l) => l.roomTypeId === rt.id)) return { error: "That rate isn't sold on that room." };
  const blocked = stayBlocked(rt.id, rp);
  if (blocked) return { error: `Not bookable: ${blocked}.` };
  if (remainingFor(rt.id, rt.totalRooms) < 1) return { error: "No availability left for those dates." };

  let accommodationMinor = 0;
  for (const k of nights) {
    const price = priceFor(rt.id, rp, k);
    if (price == null) return { error: "This rate isn't fully priced for those dates." };
    accommodationMinor += price;
  }

  /**
   * Two different numbers, deliberately.
   *
   * The RESERVATION stores accommodation, because room revenue is what ADR and RevPAR are built on
   * — folding taxes in would silently inflate every metric in the CRS.
   *
   * The GUEST is told the all-in total, because that is what they will actually pay. The folio adds
   * these same fees on arrival (same @revio/core function), so the two agree by construction rather
   * than by luck.
   */
  const charged = computeStayCharges({
    stay: { accommodationMinor, nights: nights.length, rooms: 1, guests: p.guests },
    fees,
    cityTaxIncluded: defaults?.cityTaxMode === "included",
  });
  const totalMinor = accommodationMinor;

  const email = p.guest.email.trim().toLowerCase();
  const guest =
    (await db.guest.findFirst({ where: { propertyId: property.id, email } })) ??
    (await db.guest.create({
      data: {
        tenantId: property.tenantId, propertyId: property.id,
        firstName: p.guest.firstName.trim(), lastName: p.guest.lastName.trim(),
        email, phone: p.guest.phone?.trim() || null,
      },
    }));

  // source = Booking Engine (category "direct") — first-class in the source/channel mix from day one.
  const source =
    (await db.bookingSource.findFirst({ where: { propertyId: property.id, name: "Booking Engine" } })) ??
    (await db.bookingSource.create({ data: { tenantId: property.tenantId, propertyId: property.id, name: "Booking Engine", category: "direct" } }));

  const checkIn = utcDay(p.checkIn);
  const checkOut = utcDay(p.checkOut);
  const reservation = await db.reservation.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id,
      channelId: null, externalId: null, // direct channel — never touches RevioLink/Channex inbound
      guestName: `${guest.firstName} ${guest.lastName}`,
      status: "confirmed",
      totalMinor, currency: property.baseCurrency,
      propertyCurrency: property.baseCurrency, propertyTotalMinor: totalMinor, fxRate: 1, fxAt: new Date(),
      guestId: guest.id, bookingSourceId: source.id, paymentGuarantee: "none",
      notes: "Booked via the booking-engine API",
      lines: { create: [{ roomTypeId: rt.id, ratePlanId: rp.id, quantity: 1, checkIn, checkOut, priceMinor: totalMinor, guestsCount: p.guests }] },
    },
  });

  await db.auditEntry.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id,
      entity: `Reservation #${reservation.id.slice(-6)} · ${reservation.guestName}`,
      field: "booking_engine", newValue: `${rt.name} · ${nights.length}n · €${(charged.totalMinor / 100).toFixed(2)} all-in`,
      source: "api",
    },
  });
  // Boundary rule: the sync trail shows the availability effect, not the guest/booking details
  // (those live on the reservation + audit entry above).
  await db.syncEvent.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id,
      kind: "push", status: "success",
      summary: "Availability reduced — new reservation confirmed (Booking Engine)",
    },
  });
  // The one availability truth changed — push the effect to any real channels immediately.
  try { await syncRealChannels(db, property.id); } catch { /* channel push must never fail the booking */ }

  return {
    reservationId: reservation.id,
    status: reservation.status,
    accommodationMinor,
    totalMinor: charged.totalMinor,
    charges: charged.lines.map((l) => ({ name: l.name, amountMinor: l.amountMinor })),
    currency: property.baseCurrency,
  };
}

/**
 * Real alternatives for a stay that came back empty.
 *
 * "Sold out" is the single worst screen a booking engine produces, and the honest fix is not a row
 * of hopeful links — it is to actually run the searches the guest would have run next and show only
 * the ones that come back with rooms. A chip that says a date is free and then isn't is worse than
 * no chip at all, because the guest has now been let down twice.
 *
 * So each candidate is evaluated by `publicAvailability` — the SAME function that runs when they
 * click it. Nothing here approximates availability, which means a suggestion cannot disagree with
 * the page it leads to. It costs a handful of extra queries, but only on a search that already
 * failed, which is the moment worth spending on.
 *
 * Candidates are the same LENGTH of stay shifted around the requested dates, nearest first — a
 * guest who asked for three nights in August wants three nights in August, not a different trip.
 */
export interface AlternativeStay {
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Cheapest all-in total across every room and rate — what the chip promises. */
  fromMinor: number;
  currency: string;
  /** Days from the original check-in; negative is earlier. Drives the "2 days earlier" wording. */
  offsetDays: number;
}

export async function publicAlternativeStays(
  db: Db,
  property: PropertyRow,
  q: PublicStayQuery,
  opts: { maxResults?: number; windowDays?: number } = {},
): Promise<AlternativeStay[]> {
  const maxResults = opts.maxResults ?? 4;
  const windowDays = opts.windowDays ?? 7;

  if (validStay(q)) return [];

  const start = utcDay(q.checkIn);
  const nights = Math.round((utcDay(q.checkOut).getTime() - start.getTime()) / DAY_MS);
  if (nights < 1) return [];

  const today = todayInTz(property.timezone);
  const shift = (iso: string, days: number) => ymd(new Date(utcDay(iso).getTime() + days * DAY_MS));

  // Nearest first, and earlier before later at the same distance — moving a trip forward is usually
  // the easier ask, and ties should be ordered by something rather than by chance.
  const offsets: number[] = [];
  for (let d = 1; d <= windowDays; d++) offsets.push(-d, d);

  const candidates = offsets
    .map((offsetDays) => ({
      offsetDays,
      checkIn: shift(q.checkIn, offsetDays),
      checkOut: shift(q.checkOut, offsetDays),
    }))
    .filter((c) => c.checkIn >= today);

  const found: AlternativeStay[] = [];

  // Batched rather than all-at-once: a sold-out search should not fire fourteen concurrent
  // availability loads at the database, and we stop as soon as we have enough to show.
  const BATCH = 3;
  for (let i = 0; i < candidates.length && found.length < maxResults; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (c) => {
        const res = await publicAvailability(db, property, {
          checkIn: c.checkIn, checkOut: c.checkOut, guests: q.guests,
        });
        const totals = (res.options ?? []).flatMap((o) => o.plans.map((p) => p.totalMinor));
        if (totals.length === 0) return null;
        return {
          checkIn: c.checkIn,
          checkOut: c.checkOut,
          nights,
          fromMinor: Math.min(...totals),
          currency: property.baseCurrency,
          offsetDays: c.offsetDays,
        } satisfies AlternativeStay;
      }),
    );
    for (const r of results) if (r) found.push(r);
  }

  return found
    .sort((a, b) => Math.abs(a.offsetDays) - Math.abs(b.offsetDays) || a.offsetDays - b.offsetDays)
    .slice(0, maxResults);
}
