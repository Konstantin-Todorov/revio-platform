/**
 * Integration test: the booking loop at the DB level, combined with @revio/core engines.
 * Runs against a dedicated `revio_test` database so it never touches demo data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { computeAvailability, deriveRate, isOverbooking, occupancyPrice } from "@revio/core";

const baseUrl =
  process.env.TEST_DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/revio_test`;
// Pin to one connection so the session-level RLS bypass (set in beforeAll) holds for the whole run.
const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "connection_limit=1";
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
  // This integration test writes across a tenant as the table owner, so bypass RLS for the run.
  await prisma.$executeRawUnsafe("SET app.bypass = 'on'");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);
  const tenant = await prisma.tenant.create({ data: { name: "Test", slug: `t-${Date.now()}` } });
  tenantId = tenant.id;
  const property = await prisma.property.create({ data: { tenantId, name: "Test Hotel" } });
  propertyId = property.id;
  const rt = await prisma.roomType.create({ data: { tenantId, propertyId, name: "Test Room", code: "TR", totalRooms: 8, maxGuests: 2 } });
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

describe("DB + core: book → drop availability → cancel → restore (sold is derived)", () => {
  it("availability = inventory − sold; a booking lowers it and a cancel restores it", async () => {
    const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } });
    const nextDay = new Date(date.getTime() + 86_400_000);

    // Rooms sold for the date, derived from active reservations (the source of truth).
    const soldOf = async () => {
      const lines = await prisma.reservationLine.findMany({
        where: {
          roomTypeId,
          reservation: { status: { in: ["confirmed", "modified", "overbooked"] } },
          checkIn: { lte: date },
          checkOut: { gt: date },
        },
      });
      return lines.reduce((s, l) => s + l.quantity, 0);
    };

    // No date allotment set ⇒ inventory defaults to physical totalRooms (8), nothing sold yet.
    expect(computeAvailability({ inventory: rt.totalRooms, confirmedUnits: await soldOf() })).toBe(8);

    // Book 2 rooms for the night — availability drops to 6 with no inventory mutation.
    const reservation = await prisma.reservation.create({
      data: {
        tenantId, propertyId, channelId,
        externalId: "X1", guestName: "Tester", totalMinor: 24000, currency: "EUR",
        lines: { create: [{ roomTypeId, ratePlanId: stdId, quantity: 2, checkIn: date, checkOut: nextDay }] },
      },
    });
    expect(computeAvailability({ inventory: rt.totalRooms, confirmedUnits: await soldOf() })).toBe(6);

    // A booking onto a sold-out date is flagged as overbooking.
    expect(isOverbooking(computeAvailability({ inventory: 0, confirmedUnits: 0 }))).toBe(true);

    // Cancel → sold returns to 0 → availability restores to 8.
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: "cancelled" } });
    expect(computeAvailability({ inventory: rt.totalRooms, confirmedUnits: await soldOf() })).toBe(8);
  });
});

describe("DB + core: occupancy pricing", () => {
  it("1 guest pays €10 less than the 2-guest standard", () => {
    expect(occupancyPrice(12000, { occupancy: 1, adjustmentType: "fixed", direction: "decrease", value: 1000 })).toBe(11000);
  });
});
