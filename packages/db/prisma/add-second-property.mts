/**
 * Idempotent: add a SECOND property ("Hotel Sofia — Plovdiv") to the "Hotel Sofia Group" tenant so
 * the CRS portfolio (group) scope has something to aggregate (CRS-GUIDE §4.1 / task C11). Safe to
 * re-run — it bails if the property already exists. Run inside packages/db:
 *   DATABASE_URL=... npx tsx prisma/add-second-property.mts
 */
import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/revio_dev`;
const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "connection_limit=1";
const prisma = new PrismaClient({ datasources: { db: { url } } });

const DAY = 86_400_000;
const toUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

async function main() {
  await prisma.$executeRawUnsafe("SET app.bypass = 'on'");

  const tenant = await prisma.tenant.findFirst({ where: { slug: "hotel-sofia" } });
  if (!tenant) throw new Error("Hotel Sofia Group tenant not found — run the base seed first.");
  const tenantId = tenant.id;

  const PROP_NAME = "Hotel Sofia — Plovdiv";
  const existing = await prisma.property.findFirst({ where: { tenantId, name: PROP_NAME } });
  if (existing) {
    console.log(`✓ "${PROP_NAME}" already exists (${existing.id}) — nothing to do.`);
    return;
  }

  const property = await prisma.property.create({
    data: {
      tenantId, name: PROP_NAME, timezone: "Europe/Sofia", baseCurrency: "EUR", syncHorizonDays: 365,
      address: "5 Knyaz Alexander I St, Plovdiv", contactEmail: "plovdiv@hotelsofia.demo", phone: "+359 32 000 0000",
    },
  });
  const propertyId = property.id;
  const t = { tenantId, propertyId };

  // Smaller sister property — different room mix so group totals ≠ either property alone.
  const roomTypeSpec = [
    { name: "Standard Double", code: "PSD", totalRooms: 10, maxGuests: 2, base: 9000 },
    { name: "Deluxe Room", code: "PDX", totalRooms: 6, maxGuests: 2, base: 13000 },
    { name: "Family Room", code: "PFM", totalRooms: 3, maxGuests: 4, base: 16000 },
  ];
  const rtByCode: Record<string, { id: string }> = {};
  const baseByCode: Record<string, number> = {};
  for (let i = 0; i < roomTypeSpec.length; i++) {
    const s = roomTypeSpec[i]!;
    rtByCode[s.code] = await prisma.roomType.create({
      data: { ...t, name: s.name, code: s.code, unitKind: "room", totalRooms: s.totalRooms, maxGuests: s.maxGuests, sortOrder: i },
    });
    baseByCode[s.code] = s.base;
  }

  const standard = await prisma.ratePlan.create({
    data: { ...t, name: "Standard Rate", code: "PBAR", tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0 },
  });
  for (const rt of Object.values(rtByCode)) {
    await prisma.ratePlanRoomType.create({ data: { ratePlanId: standard.id, roomTypeId: rt.id } });
  }

  await prisma.propertyDefaults.create({ data: { ...t, defMinLos: 1 } });

  const direct = await prisma.bookingSource.create({ data: { ...t, name: "Direct", category: "direct" } });
  const ota = await prisma.bookingSource.create({ data: { ...t, name: "OTA", category: "ota" } });
  const callCenter = await prisma.bookingSource.create({ data: { ...t, name: "Call Center", category: "call_center" } });

  // Reservations spanning L28D actuals → in-house → N28D on-the-books, plus one cancellation.
  const today = toUtc(new Date());
  type R = { guest: string; rt: string; nights: number; qty: number; inOffset: number; lead: number; src: string; status?: string };
  const spec: R[] = [
    { guest: "Georgi Ivanov",   rt: "PSD", nights: 2, qty: 1, inOffset: -22, lead: 12, src: "ota" },
    { guest: "Maria Dimitrova", rt: "PDX", nights: 3, qty: 1, inOffset: -18, lead: 20, src: "direct" },
    { guest: "Petar Kolev",     rt: "PSD", nights: 1, qty: 2, inOffset: -14, lead: 6,  src: "ota" },
    { guest: "Anna Stoeva",     rt: "PFM", nights: 4, qty: 1, inOffset: -10, lead: 30, src: "call_center" },
    { guest: "Nikola Angelov",  rt: "PDX", nights: 2, qty: 1, inOffset: -6,  lead: 9,  src: "direct" },
    { guest: "Elitsa Marinova", rt: "PSD", nights: 3, qty: 1, inOffset: -3,  lead: 15, src: "ota", status: "cancelled" },
    { guest: "Dimitar Hristov", rt: "PSD", nights: 2, qty: 1, inOffset: -1,  lead: 4,  src: "direct" },
    { guest: "Yana Todorova",   rt: "PDX", nights: 3, qty: 1, inOffset: 0,   lead: 11, src: "ota" },
    { guest: "Stefan Petrov",   rt: "PFM", nights: 2, qty: 1, inOffset: 2,   lead: 7,  src: "direct" },
    { guest: "Ralitsa Ilieva",  rt: "PSD", nights: 4, qty: 2, inOffset: 5,   lead: 18, src: "ota" },
    { guest: "Kaloyan Georgiev",rt: "PDX", nights: 2, qty: 1, inOffset: 9,   lead: 12, src: "call_center" },
    { guest: "Viktoria Nikolova",rt: "PSD",nights: 3, qty: 1, inOffset: 14,  lead: 22, src: "direct" },
    { guest: "Boris Aleksiev",  rt: "PFM", nights: 5, qty: 1, inOffset: 19,  lead: 25, src: "ota" },
    { guest: "Teodora Vasileva",rt: "PDX", nights: 2, qty: 1, inOffset: 24,  lead: 27, src: "ota" },
  ];
  const srcId: Record<string, string> = { direct: direct.id, ota: ota.id, call_center: callCenter.id };

  let n = 0;
  for (const r of spec) {
    const checkIn = addDays(today, r.inOffset);
    const checkOut = addDays(checkIn, r.nights);
    const importedAt = addDays(checkIn, -r.lead);
    const price = baseByCode[r.rt]! * r.nights * r.qty;
    await prisma.reservation.create({
      data: {
        ...t, channelId: null, bookingSourceId: srcId[r.src]!, guestName: r.guest,
        status: r.status ?? "confirmed",
        totalMinor: price, currency: "EUR", propertyCurrency: "EUR", propertyTotalMinor: price,
        fxRate: 1, fxAt: importedAt, importedAt,
        ...(r.status === "cancelled" ? { cancelledAt: addDays(importedAt, 2) } : {}),
        lines: { create: [{ roomTypeId: rtByCode[r.rt]!.id, ratePlanId: standard.id, quantity: r.qty, checkIn, checkOut, priceMinor: price, guestsCount: Math.min(r.qty * 2, 4) }] },
      },
    });
    n++;
  }

  console.log(`✓ Created "${PROP_NAME}" (${propertyId}) with ${roomTypeSpec.length} room types and ${n} reservations.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
