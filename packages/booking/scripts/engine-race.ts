/**
 * Races the REAL booking-engine hold path — the one a guest actually reaches.
 *
 *   pnpm --filter @revio/booking engine-race
 *
 * `packages/db/scripts/claim-verify.ts` proves the claim primitive is atomic. That is necessary and
 * not sufficient: a caller that computes the wrong sellable base, or claims the wrong dates, will
 * oversell just as happily with a perfectly atomic claim underneath it. The interesting bug lives in
 * the wiring, so the wiring is what this races.
 *
 * It fires N concurrent `publicCreateHold` calls at one room type with a known number of rooms and
 * asserts the room type is never oversold. It lives here rather than in `@revio/db` because the
 * dependency runs booking → db, never the other way, and a verification script is not a reason to
 * invert it.
 *
 * Everything it creates is cleaned up, including on failure.
 */
import { forSystem, forTenant, prisma } from "@revio/db";
import { publicCreateHold } from "../src/public-engine.js";

const RACERS = 12;
const ROOMS = 3;

function farFutureStay(): { checkIn: string; checkOut: string } {
  // A different window from claim-verify's, so the two can run back to back without colliding.
  const start = new Date(Date.now() + 430 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  return { checkIn: start.toISOString().slice(0, 10), checkOut: end.toISOString().slice(0, 10) };
}

async function main() {
  const sys = forSystem();
  const { checkIn, checkOut } = farFutureStay();

  const roomType = await sys.roomType.findFirst({
    select: { id: true, name: true, totalRooms: true, propertyId: true, tenantId: true },
    orderBy: { id: "asc" },
  });
  if (!roomType) {
    console.error("REFUSING TO RUN: no room types in this database. Seed it first: pnpm db:seed");
    process.exit(2);
  }
  const property = await sys.property.findUnique({
    where: { id: roomType.propertyId },
    select: { id: true, tenantId: true, name: true, baseCurrency: true, timezone: true },
  });
  if (!property) {
    console.error("REFUSING TO RUN: the room type has no property.");
    process.exit(2);
  }

  console.log(`\nProperty:  ${property.name}`);
  console.log(`Room type: ${roomType.name}`);
  console.log(`Stay:      ${checkIn} → ${checkOut}`);
  console.log(`Rooms: ${ROOMS} · concurrent guests: ${RACERS}\n`);

  const originalTotalRooms = roomType.totalRooms;
  await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: ROOMS } });
  const createdHoldIds: string[] = [];

  try {
    const existing = await sys.hold.count({
      where: {
        roomTypeId: roomType.id,
        status: "active",
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
      },
    });
    if (existing > 0) {
      console.error(`REFUSING TO RUN: ${existing} hold(s) already cover those dates — pick a cleaner window.`);
      process.exit(2);
    }

    const db = forTenant(property.tenantId);
    const results = await Promise.all(
      Array.from({ length: RACERS }, () =>
        publicCreateHold(db, property, { checkIn, checkOut, guests: 1, roomTypeId: roomType.id }),
      ),
    );
    for (const r of results) if (r.hold) createdHoldIds.push(r.hold.id);

    const won = results.filter((r) => r.hold).length;
    const rows = await sys.hold.findMany({
      where: {
        roomTypeId: roomType.id,
        status: "active",
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
      },
      select: { quantity: true },
    });
    const held = rows.reduce((s, r) => s + r.quantity, 0);

    const oversold = held > ROOMS;
    const everyLoserToldSo = results.every((r) => r.hold || typeof r.error === "string");

    console.log(`${oversold ? " FAIL " : "  ok  "} the booking engine never oversells — ${won} of ${RACERS} guests got a room, ${held} rooms held out of ${ROOMS}`);
    console.log(`${everyLoserToldSo ? "  ok  " : " FAIL "} every guest who lost was told why`);

    const failed = oversold || !everyLoserToldSo;
    if (failed) {
      console.error("\nThe wired path oversold. The claim primitive may be atomic and the caller wrong.");
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    if (createdHoldIds.length > 0) await sys.hold.deleteMany({ where: { id: { in: createdHoldIds } } });
    await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: originalTotalRooms } });
    console.log(`\nCleaned up. ${roomType.name} restored to ${originalTotalRooms} rooms.\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
