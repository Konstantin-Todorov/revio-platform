/**
 * Demo seed — reproduces the reference Channel Manager screenshot on LIVE dates.
 *
 * Hotel Sofia · 6 room types · 7 rate plans (Standard manual; the rest DERIVED via @revio/core) ·
 * 4 channels + mappings · a rolling calendar whose current week matches the screenshot exactly ·
 * reservations, sync/error/audit rows. Run: `pnpm --filter @revio/db db:seed`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { deriveRate, type DerivedRateConfig } from "@revio/core";

// Seed writes rows for multiple tenants, so it must bypass RLS. Pin to a single connection
// (connection_limit=1) and set app.bypass='on' once (see main()) so it persists for every statement.
const baseUrl = process.env.DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/revio_dev`;
const seedUrl = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "connection_limit=1";
const prisma = new PrismaClient({ datasources: { db: { url: seedUrl } } });
const DEMO_PASSWORD = "revio1234";

// --- date helpers ----------------------------------------------------------
const DAY = 86_400_000;
function date(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
/** Monday of the current week (UTC). */
function currentMonday(): Date {
  const today = date(new Date());
  const dow = (today.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(today, -dow);
}

async function main() {
  // Bypass row-level security for the whole seed (operator/system perimeter). Session-level SET is
  // safe here because connection_limit=1 guarantees one connection for the entire run.
  await prisma.$executeRawUnsafe("SET app.bypass = 'on'");
  console.log("Resetting demo data…");
  // Truncate everything in one statement so FK order doesn't matter (re-runnable seed).
  const tables = [
    "AuditEntry", "ErrorItem", "SyncEvent", "ReservationLine", "Reservation",
    "RestrictionRule", "DailyCell", "RatePrice", "ProductMapping", "OccupancyAdjustment",
    "RatePlanRoomType", "RatePlan", "MealPlan", "CancellationPolicy", "RoomType",
    "Channel", "Property", "User", "Tenant",
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
  await prisma.operatorUser.deleteMany();
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Operator login (us): operator@revio.app
  await prisma.operatorUser.create({
    data: { name: "Revio Operator", email: "operator@revio.app", role: "super_admin", passwordHash: pw },
  });

  // --- Tenant + operator user ---------------------------------------------
  const tenant = await prisma.tenant.create({
    data: {
      name: "Hotel Sofia Group",
      slug: "hotel-sofia",
      hasChannelManager: true,
      hasReservation: false,
      hasPms: false,
      users: {
        create: [
          { name: "Admin", email: "admin@hotelsofia.demo", role: "owner", passwordHash: pw },
          { name: "Lena Koch", email: "lena@hotelsofia.demo", role: "distribution_manager", passwordHash: pw },
        ],
      },
    },
  });
  const tenantId = tenant.id;

  const property = await prisma.property.create({
    data: {
      tenantId,
      name: "Hotel Sofia",
      timezone: "Europe/Sofia",
      baseCurrency: "EUR",
      syncHorizonDays: 365,
      address: "1 Vitosha Blvd, Sofia",
      contactEmail: "reservations@hotelsofia.demo",
      phone: "+359 2 000 0000",
    },
  });
  const propertyId = property.id;
  const t = { tenantId, propertyId };

  // --- Cancellation policies & meal plans ---------------------------------
  const [fc1, fc3, nrPolicy] = await Promise.all([
    prisma.cancellationPolicy.create({ data: { ...t, name: "Free Cancellation 1 day", code: "FC1", description: "Free cancellation up to 1 day before arrival" } }),
    prisma.cancellationPolicy.create({ data: { ...t, name: "Free Cancellation 3 days", code: "FC3", description: "Free cancellation up to 3 days before arrival" } }),
    prisma.cancellationPolicy.create({ data: { ...t, name: "Non Refundable", code: "NR", description: "100% charge on booking, non-refundable" } }),
  ]);
  const [roomOnly, breakfastIncl] = await Promise.all([
    prisma.mealPlan.create({ data: { ...t, name: "Room Only", code: "RO" } }),
    prisma.mealPlan.create({ data: { ...t, name: "Breakfast Included", code: "BI" } }),
  ]);

  // --- Room types (6 → ×7 rate plans = 42 active products, matches dashboard) ---
  const roomTypeSpec = [
    { name: "Deluxe Double Room", code: "DDR", unitKind: "room", totalInventory: 12, maxGuests: 2, basePrice: 12000 },
    { name: "Superior Twin Room", code: "STR", unitKind: "room", totalInventory: 8, maxGuests: 2, basePrice: 11000 },
    { name: "Family Room", code: "FAM", unitKind: "room", totalInventory: 4, maxGuests: 4, basePrice: 17000 },
    { name: "Suite", code: "SUI", unitKind: "room", totalInventory: 3, maxGuests: 3, basePrice: 24000 },
    { name: "Standard Single", code: "SSR", unitKind: "room", totalInventory: 6, maxGuests: 1, basePrice: 8000 },
    { name: "Studio Apartment", code: "APT", unitKind: "apartment", totalInventory: 5, maxGuests: 3, basePrice: 15000 },
  ];
  const roomTypes = [];
  for (let i = 0; i < roomTypeSpec.length; i++) {
    const s = roomTypeSpec[i]!;
    roomTypes.push(
      await prisma.roomType.create({
        data: { ...t, name: s.name, code: s.code, unitKind: s.unitKind, totalInventory: s.totalInventory, maxGuests: s.maxGuests, sortOrder: i },
      }),
    );
  }
  const basePriceByCode = Object.fromEntries(roomTypeSpec.map((s) => [s.code, s.basePrice]));
  const rtByCode = Object.fromEntries(roomTypes.map((r) => [r.code, r]));

  // --- Rate plans: Standard (manual) + 6 derived -------------------------
  const standard = await prisma.ratePlan.create({
    data: { ...t, name: "Standard Rate", code: "BAR", tags: ["flexible", "best-available"], priceLogic: "manual", cancellationPolicyId: fc1.id, mealPlanId: roomOnly.id, defMinLos: 1, sortOrder: 0 },
  });

  // Occupancy pricing: Standard Rate is quoted for 2 guests; 1 guest pays €10 less.
  await prisma.occupancyAdjustment.create({
    data: { tenantId, ratePlanId: standard.id, occupancy: 1, adjustmentType: "fixed", direction: "decrease", value: 1000, rounding: "none" },
  });

  type DerivedSpec = { name: string; code: string; tags: string[]; cfg: Omit<DerivedRateConfig, "parentRatePlanId">; policy: string; meal: string };
  const derivedSpecs: DerivedSpec[] = [
    { name: "Non Refundable", code: "NR", tags: ["non-refundable"], cfg: { adjustmentType: "percent", direction: "decrease", value: 10, rounding: "none" }, policy: nrPolicy.id, meal: roomOnly.id },
    { name: "Breakfast Rate", code: "BRF", tags: ["breakfast", "BB"], cfg: { adjustmentType: "fixed", direction: "increase", value: 1800, rounding: "none" }, policy: fc1.id, meal: breakfastIncl.id },
    { name: "Long Stay Rate", code: "LSR", tags: ["long-stay", "weekly"], cfg: { adjustmentType: "percent", direction: "decrease", value: 15, rounding: "end_99" }, policy: fc3.id, meal: roomOnly.id },
    { name: "Trip.com Rate", code: "TRP", tags: ["channel", "trip.com"], cfg: { adjustmentType: "percent", direction: "decrease", value: 5, rounding: "end_99", floorMinor: 5000 }, policy: fc1.id, meal: roomOnly.id },
    { name: "Corporate Rate", code: "COR", tags: ["corporate", "negotiated"], cfg: { adjustmentType: "percent", direction: "decrease", value: 8, rounding: "none" }, policy: fc3.id, meal: breakfastIncl.id },
    { name: "Early Booker", code: "EB", tags: ["advance-purchase"], cfg: { adjustmentType: "percent", direction: "decrease", value: 12, rounding: "end_99" }, policy: nrPolicy.id, meal: roomOnly.id },
  ];
  const ratePlans = [standard];
  for (let i = 0; i < derivedSpecs.length; i++) {
    const s = derivedSpecs[i]!;
    ratePlans.push(
      await prisma.ratePlan.create({
        data: {
          ...t, name: s.name, code: s.code, tags: s.tags, priceLogic: "derived",
          parentRatePlanId: standard.id,
          derivedType: s.cfg.adjustmentType, derivedDirection: s.cfg.direction, derivedValue: s.cfg.value,
          derivedRounding: s.cfg.rounding ?? "none", derivedFloorMinor: s.cfg.floorMinor ?? null, derivedCeilingMinor: s.cfg.ceilingMinor ?? null,
          cancellationPolicyId: s.policy, mealPlanId: s.meal, sortOrder: i + 1,
        },
      }),
    );
  }

  // Link every rate plan to every room type → 42 products.
  for (const rp of ratePlans) {
    for (const rt of roomTypes) {
      await prisma.ratePlanRoomType.create({ data: { ratePlanId: rp.id, roomTypeId: rt.id } });
    }
  }

  // --- Channels -----------------------------------------------------------
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const channelSpec = [
    { code: "booking", name: "Booking.com", currency: "EUR", commissionPct: 15, errorCount: 0, pendingCount: 6, lastSyncAt: minsAgo(1), supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "ctd", "advance_purchase_min", "advance_purchase_max", "channel_allocation"] },
    { code: "expedia", name: "Expedia", currency: "USD", commissionPct: 18, errorCount: 1, pendingCount: 4, lastSyncAt: minsAgo(2), conversionType: "auto", markupPct: 2, supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "advance_purchase_min", "advance_purchase_max"] },
    { code: "trip", name: "Trip.com", currency: "EUR", commissionPct: 15, errorCount: 1, pendingCount: 5, lastSyncAt: minsAgo(1), supportedRestrictions: ["stop_sell", "min_los", "cta", "ctd", "advance_purchase_min"] },
    { code: "agoda", name: "Agoda", currency: "USD", commissionPct: 17, errorCount: 0, pendingCount: 3, lastSyncAt: minsAgo(3), conversionType: "auto", markupPct: 2, supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "advance_purchase_min"] },
  ];
  const channels = [];
  for (const c of channelSpec) {
    channels.push(
      await prisma.channel.create({
        data: {
          ...t, code: c.code, name: c.name, status: "connected", currency: c.currency,
          commissionPct: c.commissionPct, conversionType: c.conversionType ?? "none", markupPct: c.markupPct ?? 0,
          rounding: "end_99", supportedRestrictions: c.supportedRestrictions, lastSyncAt: c.lastSyncAt,
          errorCount: c.errorCount, pendingCount: c.pendingCount, externalPropertyId: `${c.code.toUpperCase()}-100${channels.length + 1}`,
        },
      }),
    );
  }
  const chByCode = Object.fromEntries(channels.map((c) => [c.code, c]));

  // --- Mapping: most complete; leave a few incomplete (→ 5 unmapped products) ---
  let unmappedLeft = 5;
  for (const ch of channels) {
    for (const rt of roomTypes) {
      for (const rp of ratePlans) {
        const makeIncomplete = unmappedLeft > 0 && ch.code === "trip" && (rp.code === "COR" || rp.code === "EB");
        if (makeIncomplete) unmappedLeft--;
        await prisma.productMapping.create({
          data: {
            tenantId, channelId: ch.id, roomTypeId: rt.id, ratePlanId: rp.id,
            externalRoomId: makeIncomplete ? null : `${ch.code}-r-${rt.code}`,
            externalRateId: makeIncomplete ? null : `${ch.code}-rp-${rp.code}`,
            status: makeIncomplete ? "missing_rate" : "complete",
          },
        });
      }
    }
  }

  // --- Calendar: rolling prices + screenshot-exact current week for DDR ----
  const monday = currentMonday();
  const horizonStart = addDays(monday, -7);
  const HORIZON = 120; // days of price data generated from horizonStart

  // Screenshot values for Deluxe Double, Mon..Sun of the current week.
  const ddrWeekPrice = [12000, 12000, 13000, 13000, 14000, 15000, 14000];
  const ddrWeekAvail = [12, 12, 10, 8, 6, 6, 8];
  const ddrWeekMinLos = [1, 1, 2, 2, 2, 2, 1];

  const priceRows: { tenantId: string; propertyId: string; roomTypeId: string; ratePlanId: string; date: Date; priceMinor: number }[] = [];
  const cellRows: any[] = [];

  for (const rt of roomTypes) {
    const base = basePriceByCode[rt.code]!;
    for (let i = 0; i < HORIZON; i++) {
      const d = addDays(horizonStart, i);
      const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
      const weekend = dow === 5 || dow === 6;
      let price = Math.round((base * (weekend ? 1.18 : 1)) / 100) * 100;

      // Override the current week for Deluxe Double to match the screenshot exactly.
      const weekIdx = Math.round((d.getTime() - monday.getTime()) / DAY);
      const isDdrThisWeek = rt.code === "DDR" && weekIdx >= 0 && weekIdx <= 6;
      if (isDdrThisWeek) price = ddrWeekPrice[weekIdx]!;

      // Store only the Standard (manual) price; derived computed on read.
      priceRows.push({ ...t, roomTypeId: rt.id, ratePlanId: standard.id, date: d, priceMinor: price });

      if (isDdrThisWeek) {
        cellRows.push({
          ...t, roomTypeId: rt.id, date: d,
          availabilityOverride: ddrWeekAvail[weekIdx]!,
          minLos: ddrWeekMinLos[weekIdx]!,
          cta: false,
          ctd: weekIdx === 5, // Saturday closed to departure (highlighted in screenshot)
          stopSell: weekIdx === 4, // Friday stop-sell (red dot in screenshot)
        });
      }
    }
  }
  await prisma.ratePrice.createMany({ data: priceRows });
  await prisma.dailyCell.createMany({ data: cellRows });

  // sanity: confirm the derived engine reproduces the screenshot's NR/Breakfast rows
  const nrCfg: DerivedRateConfig = { parentRatePlanId: standard.id, adjustmentType: "percent", direction: "decrease", value: 10, rounding: "none" };
  const brfCfg: DerivedRateConfig = { parentRatePlanId: standard.id, adjustmentType: "fixed", direction: "increase", value: 1800, rounding: "none" };
  const nrRow = ddrWeekPrice.map((p) => deriveRate(p, nrCfg));
  const brfRow = ddrWeekPrice.map((p) => deriveRate(p, brfCfg));

  // --- Restriction rules (match screenshot) -------------------------------
  const apr = (y: number, m: number, day: number) => date(new Date(Date.UTC(y, m - 1, day)));
  const yr = monday.getUTCFullYear();
  await prisma.restrictionRule.createMany({
    data: [
      { ...t, name: "Easter Minimum Stay", type: "min_los", channelCodes: ["booking", "expedia", "trip", "agoda"], dateFrom: apr(yr, 4, 3), dateTo: apr(yr, 4, 7), valueInt: 3, priority: 10, active: true },
      { ...t, name: "Summer CTA", type: "cta", roomTypeId: rtByCode["DDR"]!.id, channelCodes: ["booking", "expedia"], dateFrom: apr(yr, 6, 1), dateTo: apr(yr, 6, 30), valueBool: true, priority: 5, active: true },
      { ...t, name: "Long Stay Min LOS", type: "min_los", channelCodes: ["booking", "expedia", "trip", "agoda"], dateFrom: apr(yr, 11, 1), dateTo: apr(yr + 1, 3, 31), valueInt: 2, priority: 3, active: true },
    ],
  });

  // --- Reservations imported from channels --------------------------------
  const resSpec = [
    { ch: "trip", ext: "123456789", guest: "David Park", rt: "SUI", rp: "BAR", nights: 5, qty: 1, inOffset: 2 },
    { ch: "booking", ext: "987654321", guest: "Marcus Reyes", rt: "DDR", rp: "BAR", nights: 3, qty: 1, inOffset: 0 },
    { ch: "expedia", ext: "555003212", guest: "Julia Tan", rt: "FAM", rp: "BRF", nights: 4, qty: 1, inOffset: 1 },
    { ch: "agoda", ext: "775541223", guest: "Sofia Almeida", rt: "STR", rp: "NR", nights: 2, qty: 2, inOffset: 3 },
    { ch: "trip", ext: "112233445", guest: "Emma Hughes", rt: "DDR", rp: "BRF", nights: 1, qty: 1, inOffset: 4 },
  ];
  const rpByCode = Object.fromEntries(ratePlans.map((r) => [r.code, r]));
  for (let i = 0; i < resSpec.length; i++) {
    const r = resSpec[i]!;
    const ch = chByCode[r.ch]!;
    const rt = rtByCode[r.rt]!;
    const rp = rpByCode[r.rp]!;
    const checkIn = addDays(monday, r.inOffset);
    const standardPrice = ddrWeekPrice[Math.min(r.inOffset, 6)] ?? basePriceByCode[r.rt]!;
    const total = standardPrice * r.nights * r.qty;
    await prisma.reservation.create({
      data: {
        ...t, channelId: ch.id, externalId: r.ext, guestName: r.guest, status: "confirmed",
        totalMinor: total, currency: ch.currency, importedAt: minsAgo([2, 5, 8, 11, 12][i] ?? 15),
        lines: { create: [{ roomTypeId: rt.id, ratePlanId: rp.id, quantity: r.qty, checkIn, checkOut: addDays(checkIn, r.nights) }] },
      },
    });
  }

  // --- Sync events (Sync Center) -----------------------------------------
  await prisma.syncEvent.createMany({
    data: [
      { ...t, channelId: chByCode["booking"]!.id, kind: "push", status: "success", summary: "Rate updated for Deluxe Double / Standard Rate", createdAt: minsAgo(1) },
      { ...t, channelId: chByCode["booking"]!.id, kind: "push", status: "success", summary: "Availability updated for 5 room types", createdAt: minsAgo(6) },
      { ...t, channelId: chByCode["expedia"]!.id, kind: "push", status: "failed", summary: "Min LOS update rejected for 03–07 May", detail: "Invalid value", createdAt: minsAgo(12) },
      { ...t, channelId: chByCode["trip"]!.id, kind: "pull", status: "success", summary: "New reservation imported (Trip.com)", createdAt: minsAgo(15) },
      { ...t, channelId: chByCode["booking"]!.id, kind: "push", status: "success", summary: "Bulk update completed", createdAt: minsAgo(20) },
    ],
  });

  // --- Error Center -------------------------------------------------------
  await prisma.errorItem.createMany({
    data: [
      { ...t, channelId: chByCode["expedia"]!.id, severity: "warning", code: "restriction_not_supported", message: "CTD not supported by Expedia", productLabel: "Deluxe Double / Standard Rate", dateAffected: addDays(monday, 5), recommendedAction: "Remove CTD for this channel or ignore", resolved: false },
      { ...t, channelId: chByCode["trip"]!.id, severity: "critical", code: "rate_not_mapped", message: "Rate plan not mapped (Corporate Rate)", productLabel: "Trip.com · Corporate Rate", recommendedAction: "Complete mapping in Channels → Mapping", resolved: false },
    ],
  });

  // --- Audit log ----------------------------------------------------------
  await prisma.auditEntry.createMany({
    data: [
      { ...t, entity: "RatePrice · Deluxe Double / Standard Rate", field: "price", oldValue: "€125", newValue: "€130", source: "manual", channelCode: "all", syncResult: "success", createdAt: minsAgo(1) },
      { ...t, entity: "DailyCell · 5 room types", field: "availability", oldValue: "—", newValue: "updated", source: "bulk", channelCode: "all", syncResult: "success", createdAt: minsAgo(6) },
      { ...t, entity: "DailyCell · Deluxe Double", field: "min_los", oldValue: "1", newValue: "2", source: "rule", channelCode: "all", syncResult: "success", createdAt: minsAgo(12) },
    ],
  });

  // --- Second tenant: Black Sea Resort (proves tenant isolation) ----------
  const tenant2 = await prisma.tenant.create({
    data: { name: "Black Sea Resort", slug: "black-sea-resort", hasChannelManager: true,
      users: { create: [{ name: "Resort Owner", email: "owner@blacksea.demo", role: "owner", passwordHash: pw }] } },
  });
  const property2 = await prisma.property.create({
    data: { tenantId: tenant2.id, name: "Black Sea Resort", timezone: "Europe/Sofia", baseCurrency: "EUR", syncHorizonDays: 365 },
  });
  const t2 = { tenantId: tenant2.id, propertyId: property2.id };
  const rt2spec = [
    { name: "Sea View Double", code: "SVD", unitKind: "room", inv: 20, max: 2, base: 16000 },
    { name: "Garden Bungalow", code: "GBL", unitKind: "apartment", inv: 10, max: 4, base: 22000 },
    { name: "Beach Suite", code: "BST", unitKind: "room", inv: 5, max: 3, base: 30000 },
  ];
  const rt2: { id: string; code: string }[] = [];
  for (let i = 0; i < rt2spec.length; i++) {
    const s = rt2spec[i]!;
    rt2.push(await prisma.roomType.create({ data: { ...t2, name: s.name, code: s.code, unitKind: s.unitKind, totalInventory: s.inv, maxGuests: s.max, sortOrder: i } }));
  }
  const std2 = await prisma.ratePlan.create({ data: { ...t2, name: "Standard Rate", code: "BAR", tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0 } });
  const plans2 = [std2];
  plans2.push(await prisma.ratePlan.create({ data: { ...t2, name: "Non Refundable", code: "NR", tags: ["non-refundable"], priceLogic: "derived", parentRatePlanId: std2.id, derivedType: "percent", derivedDirection: "decrease", derivedValue: 12, derivedRounding: "none", sortOrder: 1 } }));
  plans2.push(await prisma.ratePlan.create({ data: { ...t2, name: "Half Board", code: "HB", tags: ["half-board"], priceLogic: "derived", parentRatePlanId: std2.id, derivedType: "fixed", derivedDirection: "increase", derivedValue: 2500, derivedRounding: "none", sortOrder: 2 } }));
  for (const rp of plans2) for (const rt of rt2) await prisma.ratePlanRoomType.create({ data: { ratePlanId: rp.id, roomTypeId: rt.id } });

  const ch2: { id: string; code: string }[] = [];
  for (const c of [{ code: "booking", name: "Booking.com", cur: "EUR" }, { code: "expedia", name: "Expedia", cur: "USD" }]) {
    ch2.push(await prisma.channel.create({ data: { ...t2, code: c.code, name: c.name, status: "connected", currency: c.cur, supportedRestrictions: ["stop_sell", "min_los", "cta"], lastSyncAt: minsAgo(2), pendingCount: 2, externalPropertyId: `${c.code.toUpperCase()}-BSR` } }));
  }
  for (const ch of ch2) for (const rt of rt2) for (const rp of plans2)
    await prisma.productMapping.create({ data: { tenantId: tenant2.id, channelId: ch.id, roomTypeId: rt.id, ratePlanId: rp.id, externalRoomId: `${ch.code}-r-${rt.code}`, externalRateId: `${ch.code}-rp-${rp.code}`, status: "complete" } });

  const prices2: any[] = [];
  for (const rt of rt2) {
    const base = rt2spec.find((s) => s.code === rt.code)!.base;
    for (let i = 0; i < 60; i++) {
      const d = addDays(horizonStart, i);
      const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
      prices2.push({ ...t2, roomTypeId: rt.id, ratePlanId: std2.id, date: d, priceMinor: Math.round((base * (weekend ? 1.2 : 1)) / 100) * 100 });
    }
  }
  await prisma.ratePrice.createMany({ data: prices2 });
  await prisma.reservation.create({ data: { ...t2, channelId: ch2[0]!.id, externalId: "BS-7714", guestName: "Ivan Petrov", status: "confirmed", totalMinor: 48000, currency: "EUR", importedAt: minsAgo(7), lines: { create: [{ roomTypeId: rt2[0]!.id, ratePlanId: std2.id, quantity: 1, checkIn: monday, checkOut: addDays(monday, 3) }] } } });
  await prisma.syncEvent.create({ data: { ...t2, channelId: ch2[0]!.id, kind: "pull", status: "success", summary: "New reservation imported (Booking.com)", createdAt: minsAgo(7) } });

  // --- Report ------------------------------------------------------------
  const counts = {
    roomTypes: roomTypes.length,
    ratePlans: ratePlans.length,
    activeProducts: roomTypes.length * ratePlans.length,
    channels: channels.length,
    mappings: await prisma.productMapping.count(),
    unmappedProducts: await prisma.productMapping.count({ where: { status: { not: "complete" } } }),
    priceRows: priceRows.length,
    reservations: resSpec.length,
  };
  console.log("Seed complete:", JSON.stringify(counts, null, 2));
  console.log("DDR week — Standard:", ddrWeekPrice.map((p) => p / 100).join(", "));
  console.log("DDR week — NonRefundable (derived):", nrRow.map((p) => p / 100).join(", "));
  console.log("DDR week — Breakfast (derived):", brfRow.map((p) => p / 100).join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
