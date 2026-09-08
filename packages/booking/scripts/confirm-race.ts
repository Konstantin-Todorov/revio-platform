/**
 * Races the REAL confirm path — N guests pressing Confirm on the SAME hold at the same instant.
 *
 *   pnpm --filter @revio/booking confirm-race
 *
 * ## Why this exists beside `engine-race`
 *
 * `engine-race` proves the *hold* is never oversold. That is the first half of the promise and it
 * has been green for weeks — while the second half was broken. A hold could be converted twice:
 * every confirm read it as active, every confirm wrote its own reservation, and the conversion's
 * affected count was thrown away, so the second one matched zero rows and nobody noticed. One hold,
 * two reservations, one room. `engine-race` cannot see that, because at hold time nothing is wrong.
 *
 * So this races the other end. One room, one hold, twelve confirms.
 *
 * **What it asserts** — all four, because three of them can be true while the platform still
 * double-books:
 *
 *   1. exactly ONE confirm returns a reservation;
 *   2. every loser is told, in words, and never with a thrown error;
 *   3. the database holds exactly ONE reservation line for that room type over those nights — this
 *      is the assertion that fails on the old code, and the only one that cannot be satisfied by a
 *      well-behaved return value;
 *   4. the hold is `converted` and points at the reservation that actually exists — a hold pointing
 *      at a rolled-back id would mean the two halves committed separately.
 *
 * **Each racer books under a different email on purpose.** The realistic trigger is one guest
 * double-tapping, but sharing an email makes the guest lookup race too, and then "two reservations
 * exist" no longer isolates the hold. Distinct guests keep exactly one thing contended.
 *
 * Everything it creates is cleaned up, including on failure.
 */
import { forSystem, forTenant, prisma } from "@revio/db";
import { publicAvailability, publicCreateHold, publicCreateReservation } from "../src/public-engine.js";

const RACERS = 12;
const ROOMS = 1;

function farFutureStay(): { checkIn: string; checkOut: string } {
  // A different window again from claim-verify's and engine-race's, so all three can run back to back.
  const start = new Date(Date.now() + 470 * 86_400_000);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  return { checkIn: start.toISOString().slice(0, 10), checkOut: end.toISOString().slice(0, 10) };
}

async function main() {
  const sys = forSystem();
  const { checkIn, checkOut } = farFutureStay();

  const property = await sys.property.findFirst({
    where: { roomTypes: { some: {} } },
    select: { id: true, tenantId: true, name: true, baseCurrency: true, timezone: true },
    orderBy: { id: "asc" },
  });
  if (!property) {
    console.error("REFUSING TO RUN: no property with room types in this database. Seed it first: pnpm db:seed");
    process.exit(2);
  }

  const db = forTenant(property.tenantId);

  // Pick through the guest's own path rather than off the schema: a room type with no directly
  // bookable, fully priced rate plan is not a case this script can race, and finding that out from
  // `publicAvailability` is finding it out the way a guest would.
  const { options, error } = await publicAvailability(db, property, { checkIn, checkOut, guests: 1 });
  const option = options?.find((o) => o.plans.length > 0 && o.maxGuests >= 1);
  const plan = option?.plans[0];
  if (!option || !plan) {
    console.error(`REFUSING TO RUN: nothing bookable on ${checkIn}→${checkOut}${error ? ` (${error})` : ""}.`);
    process.exit(2);
  }

  const roomType = await sys.roomType.findUniqueOrThrow({
    where: { id: option.roomTypeId },
    select: { id: true, name: true, totalRooms: true },
  });

  console.log(`\nProperty:  ${property.name}`);
  console.log(`Room type: ${roomType.name}`);
  console.log(`Rate plan: ${plan.name}`);
  console.log(`Stay:      ${checkIn} → ${checkOut}`);
  console.log(`Rooms: ${ROOMS} · one hold · concurrent confirms: ${RACERS}\n`);

  const originalTotalRooms = roomType.totalRooms;
  await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: ROOMS } });

  const emails = Array.from({ length: RACERS }, (_, i) => `race-confirm-${i}@revio.invalid`);
  let holdId: string | null = null;

  try {
    const clash = await sys.hold.count({
      where: {
        roomTypeId: roomType.id,
        status: "active",
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
      },
    });
    if (clash > 0) {
      console.error(`REFUSING TO RUN: ${clash} hold(s) already cover those dates — pick a cleaner window.`);
      process.exit(2);
    }

    const held = await publicCreateHold(db, property, { checkIn, checkOut, guests: 1, roomTypeId: roomType.id });
    if (!held.hold) {
      console.error(`REFUSING TO RUN: could not take the hold to race (${held.error ?? "no reason given"}).`);
      process.exit(2);
    }
    holdId = held.hold.id;

    const settled = await Promise.allSettled(
      emails.map((email, i) =>
        publicCreateReservation(db, property, {
          checkIn,
          checkOut,
          guests: 1,
          roomTypeId: roomType.id,
          ratePlanId: plan.ratePlanId,
          holdId: holdId!,
          guest: { firstName: "Race", lastName: `Guest${i}`, email },
        }),
      ),
    );

    const threw = settled.filter((s) => s.status === "rejected");
    const results = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    const winners = results.filter((r) => r.reservationId);
    const losersTold = results.filter((r) => !r.reservationId && typeof r.error === "string" && r.error.length > 0);

    // The one that matters. Ask the database, not the return values — a call that answers "booked"
    // and a row that exists are different claims, and it is the row that takes the room.
    const lines = await sys.reservationLine.findMany({
      where: {
        roomTypeId: roomType.id,
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
        reservation: { guest: { email: { in: emails } } },
      },
      select: { reservationId: true },
    });

    const hold = await sys.hold.findUniqueOrThrow({
      where: { id: holdId },
      select: { status: true, reservationId: true },
    });

    const okOneWinner = winners.length === 1;
    const okLosersTold = threw.length === 0 && losersTold.length === RACERS - 1;
    const okOneRow = lines.length === 1;
    const okHoldPoints =
      hold.status === "converted" && hold.reservationId !== null && hold.reservationId === lines[0]?.reservationId;

    const mark = (ok: boolean) => (ok ? "  ok  " : " FAIL ");
    console.log(`${mark(okOneWinner)} exactly one confirm won — ${winners.length} of ${RACERS}`);
    console.log(`${mark(okLosersTold)} every loser was told why — ${losersTold.length} told, ${threw.length} threw`);
    console.log(`${mark(okOneRow)} exactly one reservation exists in the database — found ${lines.length}`);
    console.log(`${mark(okHoldPoints)} the hold is converted and points at that reservation — ${hold.status}, ${hold.reservationId ?? "null"}`);

    const failed = !(okOneWinner && okLosersTold && okOneRow && okHoldPoints);
    if (failed) {
      console.error(
        "\nOne hold produced more than one reservation, or the two halves did not commit together.\n" +
          "The conversion must be the claim: `updateMany … WHERE status = 'active'`, its count checked,\n" +
          "and the reservation written inside the same transaction so a loser rolls its own back.",
      );
      if (winners.length > 0) console.error(`Winners: ${winners.map((w) => w.reservationId).join(", ")}`);
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    const guests = await sys.guest.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const guestIds = guests.map((g) => g.id);
    const reservations = await sys.reservation.findMany({
      where: { guestId: { in: guestIds } },
      select: { id: true },
    });
    const reservationIds = reservations.map((r) => r.id);
    if (reservationIds.length > 0) {
      // The hold points at the reservation, so let go of it first; lines, night rates and extras all
      // cascade from the reservation itself.
      await sys.hold.updateMany({ where: { reservationId: { in: reservationIds } }, data: { reservationId: null } });
      await sys.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }
    if (guestIds.length > 0) await sys.guest.deleteMany({ where: { id: { in: guestIds } } });
    if (holdId) await sys.hold.deleteMany({ where: { id: holdId } });
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
