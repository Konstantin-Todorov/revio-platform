/**
 * Twelve DIFFERENT guests are put into the SAME room for the same nights at the same instant.
 * One may get it.
 *
 *   pnpm --filter @revio/pms unit-claim-race
 *
 * Not a double press — twelve distinct reservations. This is two receptionists doing walk-ins in
 * the same second, or a walk-in landing while auto-assignment sweeps, or a room move into a room
 * the sweep just picked. Every one of those paths checked "is anybody in this room?" and then
 * wrote, and a transaction alone does not make that safe: under READ COMMITTED two transactions
 * both count zero, because neither can see the other's uncommitted assignment.
 */
import { forSystem, withTenantTransaction } from "@revio/db";
import { claimUnitForStay } from "../lib/claim-unit";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`unit-claim-race writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const RACERS = 12;
const MARKER = `unit-race-${Date.now()}`;

async function main() {
  const sys = forSystem();
  const unit = await sys.unit.findFirst({
    where: { hkStatus: { not: "out_of_order" } },
    select: { id: true, label: true, roomTypeId: true, propertyId: true, tenantId: true },
    orderBy: { id: "asc" },
  });
  const ratePlan = unit ? await sys.ratePlan.findFirst({ where: { propertyId: unit.propertyId }, orderBy: { id: "asc" } }) : null;
  if (!unit || !ratePlan) {
    console.error("REFUSING TO RUN: no unit and rate plan to race on. Seed it first: pnpm db:seed");
    process.exit(2);
  }
  // Far enough out that no seeded stay or other harness is in the room.
  const checkIn = new Date("2029-05-10T00:00:00Z");
  const checkOut = new Date("2029-05-12T00:00:00Z");

  // Twelve genuinely different bookings, each wanting that room.
  const lines: { reservationId: string; lineId: string }[] = [];
  for (let i = 0; i < RACERS; i++) {
    const r = await sys.reservation.create({
      data: {
        tenantId: unit.tenantId, propertyId: unit.propertyId, guestName: `Guest${i} ${MARKER}`,
        status: "confirmed", totalMinor: 10_000, currency: "EUR",
        lines: { create: [{ roomTypeId: unit.roomTypeId, ratePlanId: ratePlan.id, quantity: 1, checkIn, checkOut, priceMinor: 10_000 }] },
      },
      include: { lines: true },
    });
    lines.push({ reservationId: r.id, lineId: r.lines[0]!.id });
  }

  console.log(`\nUnit ${unit.label} · ${RACERS} different reservations claiming it for ${checkIn.toISOString().slice(0, 10)} → ${checkOut.toISOString().slice(0, 10)}\n`);
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "  ok  " : " FAIL "} ${name} — ${detail}`);
  };

  try {
    /*
     * ⚠️ Warm the pool first, or this proves nothing.
     *
     * The first version raced twelve cold transactions and reported 1 of 12 against code with no
     * lock at all — because Prisma opens a connection per new interactive transaction, and opening
     * one takes long enough that the first transaction had committed before the others counted.
     * That is not the code being safe; it is the harness being slow. In production the pool is
     * warm, and two receptionists do not wait for each other's TCP handshake.
     */
    await Promise.all(Array.from({ length: RACERS }, () => withTenantTransaction(unit.tenantId, async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(0.05)`;
    })));

    const results = await Promise.allSettled(
      lines.map((l) =>
        withTenantTransaction(unit.tenantId, (tx) =>
          claimUnitForStay(tx, {
            tenantId: unit.tenantId, propertyId: unit.propertyId, reservationId: l.reservationId,
            reservationLineId: l.lineId, unitId: unit.id, checkIn, checkOut,
          }),
        ),
      ),
    );
    const got = results.filter((r) => r.status === "fulfilled" && r.value !== null).length;
    const threw = results.filter((r) => r.status === "rejected").length;
    const inRoom = await sys.roomAssignment.count({
      where: { unitId: unit.id, status: "active", checkedOutAt: null, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
    });
    record("exactly one guest is in the room", inRoom === 1, `${inRoom} active assignment(s) for one room`);
    record("exactly one claim succeeded", got === 1, `${got} of ${RACERS}`);
    record("the others were refused, not crashed", threw === 0, `${threw} threw`);
  } finally {
    const ids = lines.map((l) => l.reservationId);
    await sys.roomAssignment.deleteMany({ where: { reservationId: { in: ids } } });
    await sys.reservation.deleteMany({ where: { id: { in: ids } } });
    console.log("\nCleaned up.");
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
