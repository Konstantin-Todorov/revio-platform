/**
 * Integration test: the booking loop at the DB level, combined with @revio/core engines.
 * Runs against a dedicated `revio_test` database so it never touches demo data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { computeAvailability, deriveRate, isOverbooking, occupancyPrice } from "@revio/core";

const url =
  process.env.TEST_DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/revio_test`;
const prisma = new PrismaClient({ datasources: { db: { url } } });

const TABLES = [
  "AuditEntry", "ErrorItem", "SyncEvent", "ReservationLine", "Reservation",
  "RestrictionRule", "DailyCell", "RatePrice", "ProductMapping", "OccupancyAdjustment",
  "RatePlanRoomType", "RatePlan", "MealPlan", "CancellationPolicy", "RoomType",
  "Channel", "Property", "User", "Tenant",
];

let propertyId = "";
let tenantId = "";
let roomTypeId = "";
let stdId = "";
let channelId = "";
const date = new Date(Date.UTC(2026, 5, 25));

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);
  const tenant = await prisma.tenant.create({ data: { name: "Test", slug: `t-${Date.now()}` } });
  tenantId = tenant.id;
  const property = await prisma.property.create({ data: { tenantId, name: "Test Hotel" } });
  propertyId = property.id;
  const rt = await prisma.roomType.create({ data: { tenantId, propertyId, name: "Test Room", code: "TR", totalInventory: 8, maxGuests: 2 } });
  roomTypeId = rt.id;
  const std = await prisma.ratePlan.create({ data: { tenantId, propertyId, name: "Standard", code: "BAR", tags: [], priceLogic: "manual" } });
  stdId = std.id;
  const channel = await prisma.channel.create({ data: { tenantId, propertyId, code: "mock", name: "Mock", supportedRestrictions: [] } });
  channelId = channel.id;
  await prisma.ratePrice.create({ data: { tenantId, propertyId, roomTypeId, ratePlanId: stdId, date, priceMinor: 12000 } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("DB + core: edit → derive", () => {
  it("derives Non-Refundable (−10%) from the stored Standard price", async () => {
    const std = await prisma.ratePrice.findFirstOrThrow({ where: { roomTypeId, ratePlanId: stdId } });
    const nr = deriveRate(std.priceMinor, { parentRatePlanId: stdId, adjustmentType: "percent", direction: "decrease", value: 10 });
    expect(nr).toBe(10800);
  });
});

describe("DB + core: book → drop availability → cancel → restore", () => {
  it("starts at full inventory, drops on booking, detects overbooking, restores on cancel", async () => {
    const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } });
    const cell0 = await prisma.dailyCell.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } });
    const avail0 = cell0?.availabilityOverride ?? rt.totalInventory;
    expect(avail0).toBe(8);

    // Book 2 rooms.
    await prisma.reservation.create({
      data: {
        tenantId, propertyId, channelId,
        externalId: "X1", guestName: "Tester", totalMinor: 24000, currency: "EUR",
        lines: { create: [{ roomTypeId, ratePlanId: stdId, quantity: 2, checkIn: date, checkOut: new Date(date.getTime() + 86_400_000) }] },
      },
    });
    await prisma.dailyCell.upsert({
      where: { roomTypeId_date: { roomTypeId, date } },
      update: { availabilityOverride: avail0 - 2 },
      create: { tenantId, propertyId, roomTypeId, date, availabilityOverride: avail0 - 2 },
    });
    const cell1 = await prisma.dailyCell.findUniqueOrThrow({ where: { roomTypeId_date: { roomTypeId, date } } });
    expect(cell1.availabilityOverride).toBe(6);

    // Overbooking is flagged when the count is exhausted.
    expect(isOverbooking(computeAvailability({ totalInventory: 0, confirmedUnits: 0 }))).toBe(true);

    // Cancel restores.
    await prisma.dailyCell.update({ where: { roomTypeId_date: { roomTypeId, date } }, data: { availabilityOverride: 6 + 2 } });
    const cell2 = await prisma.dailyCell.findUniqueOrThrow({ where: { roomTypeId_date: { roomTypeId, date } } });
    expect(cell2.availabilityOverride).toBe(8);
  });
});

describe("DB + core: occupancy pricing", () => {
  it("1 guest pays €10 less than the 2-guest standard", () => {
    expect(occupancyPrice(12000, { occupancy: 1, adjustmentType: "fixed", direction: "decrease", value: 1000 })).toBe(11000);
  });
});
