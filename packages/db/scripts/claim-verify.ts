/**
 * Proves the inventory claim is atomic — by racing it.
 *
 *   pnpm --filter @revio/db claim-verify
 *
 * This is the only kind of test worth having for X1. A unit test with a mocked database proves
 * nothing about a race: the bug was never in the arithmetic, it was in the gap between reading the
 * arithmetic's answer and acting on it. So this script fires N genuinely concurrent claims at a room
 * type with a known number of rooms and asserts that **exactly that many succeed** — no more.
 *
 * It also runs the OLD read-then-write shape against the same room type first, and asserts that the
 * old shape *does* oversell. If that assertion ever stops holding, this machine is too slow or too
 * serialised to reproduce the race, and a pass from the new code below would be meaningless. A test
 * that cannot fail for the right reason is not evidence, so it says so and exits.
 *
 * Everything it creates is rolled back at the end, including on failure.
 *
 * This proves the PRIMITIVE. It deliberately does not reach into the booking engine, because
 * `@revio/db` may not import `@revio/booking` — that is the dependency direction, and a verification
 * script is not a reason to invert it. The wired path is raced by
 * `packages/booking/scripts/engine-race.ts`, which is allowed to see both. Run both: an atomic claim
 * called with the wrong sellable base oversells just as happily as no claim at all.
 */
import { prisma } from "../src/client.js";
import { forSystem } from "../src/rls.js";
import { claimHold } from "../src/inventory-claim.js";

const RACERS = 12;
/** The room type gets exactly this many rooms for the duration of the test. */
const ROOMS = 3;

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Dates far enough out that no seeded reservation or hold can be sitting on them. */
function farFutureStay(): { checkIn: string; checkOut: string } {
  const start = new Date(Date.now() + 400 * 86_400_000);
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
  console.log(`\nRoom type: ${roomType.name} (${roomType.id})`);
  console.log(`Stay: ${checkIn} → ${checkOut}`);
  console.log(`Rooms for the test: ${ROOMS} · concurrent claimants: ${RACERS}\n`);

  const originalTotalRooms = roomType.totalRooms;
  await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: ROOMS } });

  const sellableByNight: Record<string, number> = {};
  for (
    let t = new Date(`${checkIn}T00:00:00Z`).getTime();
    t < new Date(`${checkOut}T00:00:00Z`).getTime();
    t += 86_400_000
  ) {
    sellableByNight[new Date(t).toISOString().slice(0, 10)] = ROOMS;
  }
  const expiresAt = new Date(Date.now() + 10 * 60_000);

  /** Everything this script wrote, so the cleanup is exact rather than a date-range delete. */
  const createdHoldIds: string[] = [];

  async function activeHolds(): Promise<number> {
    const rows = await sys.hold.findMany({
      where: {
        roomTypeId: roomType!.id,
        status: "active",
        checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
        checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
      },
      select: { id: true, quantity: true },
    });
    return rows.reduce((s, r) => s + r.quantity, 0);
  }

  async function clearHolds() {
    await sys.hold.deleteMany({ where: { id: { in: createdHoldIds } } });
    createdHoldIds.length = 0;
  }

  try {
    const preexisting = await activeHolds();
    if (preexisting > 0) {
      console.error(`REFUSING TO RUN: ${preexisting} hold(s) already cover those dates — pick a cleaner window.`);
      process.exit(2);
    }

    // ---------------------------------------------------------------------
    // 1. The OLD shape. This must oversell, or the race is not reproducible
    //    on this machine and a pass below would prove nothing.
    // ---------------------------------------------------------------------
    const naive = await Promise.all(
      Array.from({ length: RACERS }, async () => {
        const held = await sys.hold.findMany({
          where: {
            roomTypeId: roomType!.id,
            status: "active",
            expiresAt: { gt: new Date() },
            checkIn: { lt: new Date(`${checkOut}T00:00:00Z`) },
            checkOut: { gt: new Date(`${checkIn}T00:00:00Z`) },
          },
          select: { quantity: true },
        });
        const used = held.reduce((s, h) => s + h.quantity, 0);
        if (used + 1 > ROOMS) return null; // the check that looks correct and is not
        const created = await sys.hold.create({
          data: {
            tenantId: roomType!.tenantId,
            propertyId: roomType!.propertyId,
            roomTypeId: roomType!.id,
            quantity: 1,
            checkIn: new Date(`${checkIn}T00:00:00Z`),
            checkOut: new Date(`${checkOut}T00:00:00Z`),
            status: "active",
            expiresAt,
          },
          select: { id: true },
        });
        return created.id;
      }),
    );
    for (const id of naive) if (id) createdHoldIds.push(id);
    const naiveHeld = await activeHolds();
    record(
      "the old read-then-write shape oversells (the race is reproducible here)",
      naiveHeld > ROOMS,
      `${naiveHeld} rooms held out of ${ROOMS}`,
    );
    if (naiveHeld <= ROOMS) {
      console.error(
        "\nThe race did not reproduce, so the result below would be meaningless.\n" +
          "Re-run; if it never reproduces, raise RACERS or run against a database with real latency.",
      );
      await clearHolds();
      await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: originalTotalRooms } });
      process.exit(2);
    }
    await clearHolds();

    // ---------------------------------------------------------------------
    // 2. The atomic claim, same race, same room type.
    // ---------------------------------------------------------------------
    const results = await Promise.all(
      Array.from({ length: RACERS }, () =>
        claimHold({
          tenantId: roomType!.tenantId,
          propertyId: roomType!.propertyId,
          roomTypeId: roomType!.id,
          quantity: 1,
          checkIn,
          checkOut,
          expiresAt,
          sellableByNight,
        }),
      ),
    );
    for (const r of results) if (r.ok) createdHoldIds.push(r.holdId);

    const won = results.filter((r) => r.ok).length;
    const lost = results.length - won;
    const claimedHeld = await activeHolds();

    record("exactly the available rooms were claimed", won === ROOMS, `${won} of ${RACERS} claims won`);
    record("nothing was oversold", claimedHeld <= ROOMS, `${claimedHeld} rooms held out of ${ROOMS}`);
    record(
      "every loser was told it lost",
      lost === RACERS - ROOMS && results.every((r) => r.ok || r.reason === "sold-out"),
      `${lost} claims returned sold-out`,
    );

    // ---------------------------------------------------------------------
    // 3. A claim for a night the caller never priced must fail, not sell.
    // ---------------------------------------------------------------------
    await clearHolds();
    const unpriced = await claimHold({
      tenantId: roomType.tenantId,
      propertyId: roomType.propertyId,
      roomTypeId: roomType.id,
      quantity: 1,
      checkIn,
      checkOut,
      expiresAt,
      sellableByNight: {}, // no night has a sellable count
    });
    if (unpriced.ok) createdHoldIds.push(unpriced.holdId);
    record("a night with no sellable count is worth zero rooms, not unlimited", !unpriced.ok, unpriced.ok ? "it sold" : "refused");
  } finally {
    await clearHolds();
    await sys.roomType.update({ where: { id: roomType.id }, data: { totalRooms: originalTotalRooms } });
    console.log(`\nCleaned up. ${roomType.name} restored to ${originalTotalRooms} rooms.`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
