/**
 * Create the dedicated RevioLink **certification property** and wire it to the Channex sandbox, so
 * ARI edits made in the RevioLink UI push live to Channex — the last gate for PMS certification
 * (see docs/CHANNEX-CERTIFICATION.md §4). The property mirrors the Channex sandbox 1:1:
 *   Double Room + Twin Room, each with Best Available Rate + Breakfast (4 rate plans),
 *   a channel in channex_sandbox mode, room + rate mappings to the Channex UUIDs.
 *
 * Idempotent: deletes any existing "Revio Cert Hotel" on the tenant, then recreates it clean.
 *
 * Reads the Channex object ids from env (from packages/connectivity/.env.local — NOT secrets, just
 * sandbox object ids). The API KEY is NOT set here; it lives as CHANNEX_SANDBOX_KEY on the CM service.
 *
 *   set -a && . ../connectivity/.env.local && set +a
 *   DATABASE_URL=... TENANT_SLUG=hotel-sofia pnpm --filter @revio/db tsx scripts/cert-property.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CH = {
  property: process.env.CHANNEX_PROPERTY_ID!,
  doubleRoom: process.env.CHANNEX_DOUBLE_ROOM_ID!,
  twinRoom: process.env.CHANNEX_TWIN_ROOM_ID!,
  doubleBar: process.env.CHANNEX_DOUBLE_BAR_ID!,
  doubleBreakfast: process.env.CHANNEX_DOUBLE_BREAKFAST_ID!,
  twinBar: process.env.CHANNEX_TWIN_BAR_ID!,
  twinBreakfast: process.env.CHANNEX_TWIN_BREAKFAST_ID!,
};
const TENANT_SLUG = process.env.TENANT_SLUG ?? "hotel-sofia";
const PRICE_DAYS = 120;

function ymd(offset: number): Date {
  return new Date(new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10) + "T00:00:00Z");
}

async function main() {
  for (const [k, v] of Object.entries(CH)) {
    if (!v) throw new Error(`Missing env for Channex ${k} — load packages/connectivity/.env.local first.`);
  }
  await prisma.$executeRawUnsafe("SET app.bypass = 'on'"); // operator/system perimeter for setup

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
  const t = { tenantId: tenant.id };

  // Idempotent: drop a previous cert property (cascade removes its rooms/rates/channel/mappings).
  const existing = await prisma.property.findFirst({ where: { tenantId: tenant.id, name: "Revio Cert Hotel" } });
  if (existing) {
    await prisma.property.delete({ where: { id: existing.id } });
    console.log("Removed previous Revio Cert Hotel.");
  }

  const property = await prisma.property.create({
    data: { ...t, name: "Revio Cert Hotel", timezone: "Europe/Sofia", baseCurrency: "EUR", syncHorizonDays: 500, address: "Channex certification sandbox" },
  });
  const p = { tenantId: tenant.id, propertyId: property.id };

  // 2 room types.
  const double = await prisma.roomType.create({ data: { ...p, name: "Double Room", code: "DBL", unitKind: "room", totalRooms: 6, maxGuests: 2, sortOrder: 0 } });
  const twin = await prisma.roomType.create({ data: { ...p, name: "Twin Room", code: "TWN", unitKind: "room", totalRooms: 8, maxGuests: 2, sortOrder: 1 } });

  // 4 rate plans, each linked to exactly ONE room (mirrors Channex, where a rate plan belongs to a room).
  const mk = (name: string, code: string, room: { id: string }, sort: number) =>
    prisma.ratePlan.create({
      data: { ...p, name, code, priceLogic: "manual", tags: [], defMinLos: 1, sortOrder: sort, roomTypeLinks: { create: [{ roomTypeId: room.id }] } },
    });
  const dblBar = await mk("Best Available Rate", "DBL-BAR", double, 0);
  const dblBb = await mk("Breakfast", "DBL-BB", double, 1);
  const twnBar = await mk("Best Available Rate", "TWN-BAR", twin, 2);
  const twnBb = await mk("Breakfast", "TWN-BB", twin, 3);

  // Daily prices (needed so pushes have content). Weekday/weekend variation.
  const priceRows: { tenantId: string; propertyId: string; roomTypeId: string; ratePlanId: string; date: Date; priceMinor: number }[] = [];
  const plans = [
    { plan: dblBar, room: double, base: 12000 }, { plan: dblBb, room: double, base: 14000 },
    { plan: twnBar, room: twin, base: 11000 }, { plan: twnBb, room: twin, base: 13000 },
  ];
  for (let i = 0; i < PRICE_DAYS; i++) {
    const date = ymd(i);
    const weekend = [5, 6].includes(date.getUTCDay());
    for (const { plan, room, base } of plans) {
      priceRows.push({ ...p, roomTypeId: room.id, ratePlanId: plan.id, date, priceMinor: base + (weekend ? 2000 : 0) });
    }
  }
  await prisma.ratePrice.createMany({ data: priceRows.map((r) => ({ ...r, source: "seed" })) });

  // Channel in channex_sandbox mode, pointed at the Channex property.
  const channel = await prisma.channel.create({
    data: {
      ...p, code: "channex", name: "Channex Sandbox", status: "connected",
      connectivityMode: "channex_sandbox", externalPropertyId: CH.property, currency: "EUR",
      commissionPct: 0, conversionType: "none", markupPct: 0, rounding: "none",
      supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "ctd"],
    },
  });

  // Two-stream mappings → Channex UUIDs (this is the "map them").
  await prisma.channelRoomTypeMapping.createMany({
    data: [
      { ...t, channelId: channel.id, roomTypeId: double.id, externalRoomId: CH.doubleRoom, status: "complete" },
      { ...t, channelId: channel.id, roomTypeId: twin.id, externalRoomId: CH.twinRoom, status: "complete" },
    ],
  });
  await prisma.channelRatePlanMapping.createMany({
    data: [
      { ...t, channelId: channel.id, ratePlanId: dblBar.id, externalRateId: CH.doubleBar, status: "complete" },
      { ...t, channelId: channel.id, ratePlanId: dblBb.id, externalRateId: CH.doubleBreakfast, status: "complete" },
      { ...t, channelId: channel.id, ratePlanId: twnBar.id, externalRateId: CH.twinBar, status: "complete" },
      { ...t, channelId: channel.id, ratePlanId: twnBb.id, externalRateId: CH.twinBreakfast, status: "complete" },
    ],
  });

  console.log(`\n✓ Revio Cert Hotel ready on tenant "${tenant.slug}".`);
  console.log(`  property=${property.id}`);
  console.log(`  2 room types · 4 rate plans · ${priceRows.length} price rows`);
  console.log(`  channel "Channex Sandbox" (channex_sandbox) → ${CH.property}, all rooms + rates mapped.`);
  console.log(`\nNext: set CHANNEX_SANDBOX_KEY on the channel-manager service, then edit a rate in the`);
  console.log(`RevioLink calendar for this property → it pushes live to Channex.`);
}

main()
  .catch((e) => { console.error("cert-property failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
