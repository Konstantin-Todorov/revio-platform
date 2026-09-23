/**
 * Twelve people mark the SAME room out of order at the same instant. One period may exist.
 *
 *   pnpm --filter @revio/pms ooo-race
 *
 * A room going out of order writes a `RoomInventoryPeriod` that takes one room off sale on every
 * channel. Two of them for one broken room takes TWO rooms off sale. Housekeeping marks rooms from a
 * phone, where a double tap is ordinary, and maintenance can mark the same room from a task.
 */
import { forSystem, withTenantTransaction } from "@revio/db";
import { takeUnitOutOfOrder, returnUnitToService } from "../lib/unit-ooo";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`ooo-race writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const RACERS = 12;

async function main() {
  const sys = forSystem();
  // A unit nobody has taken out of order, so the run starts from a known state and restores it.
  const unit = await sys.unit.findFirst({
    where: { hkStatus: { not: "out_of_order" }, inventoryPeriods: { none: {} } },
    select: { id: true, label: true, roomTypeId: true, propertyId: true, tenantId: true, hkStatus: true },
    orderBy: { id: "asc" },
  });
  if (!unit) {
    console.error("REFUSING TO RUN: no in-service unit without an existing period. Seed it first: pnpm db:seed");
    process.exit(2);
  }
  console.log(`\nUnit ${unit.label} (${unit.hkStatus}) · ${RACERS} concurrent "out of order"\n`);

  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "  ok  " : " FAIL "} ${name} — ${detail}`);
  };

  try {
    // Warm the pool, or a cold one serialises the racers by accident — see unit-claim-race.ts, where
    // twelve cold transactions reported 1 of 12 against code with no lock at all.
    await Promise.all(Array.from({ length: RACERS }, () => withTenantTransaction(unit.tenantId, async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(0.05)`;
    })));

    const results = await Promise.allSettled(
      Array.from({ length: RACERS }, () =>
        takeUnitOutOfOrder(unit.tenantId, unit.propertyId, { id: unit.id, roomTypeId: unit.roomTypeId }, "ooo-race"),
      ),
    );
    const created = results.filter((r) => r.status === "fulfilled" && r.value?.created).length;
    const threw = results.filter((r) => r.status === "rejected").length;
    const periods = await sys.roomInventoryPeriod.count({ where: { unitId: unit.id } });
    const after = await sys.unit.findUnique({ where: { id: unit.id }, select: { hkStatus: true } });
    record("exactly one out-of-order period exists for the room", periods === 1, `found ${periods}`);
    record("exactly one caller reports having created it", created === 1, `${created} of ${RACERS}`);
    record("nobody failed — a second tap is a no-op, not an error", threw === 0, `${threw} threw`);
    record("the room reads out of order", after?.hkStatus === "out_of_order", after?.hkStatus ?? "missing");

    // And back. Twelve "back in service" at once must leave no period and report the freed window
    // exactly once — a second report would push the same dates back on sale twice.
    const back = await Promise.allSettled(
      Array.from({ length: RACERS }, () => returnUnitToService(unit.tenantId, { id: unit.id }, "dirty")),
    );
    const reported = back.filter((r) => r.status === "fulfilled" && r.value.removed.length > 0).length;
    const left = await sys.roomInventoryPeriod.count({ where: { unitId: unit.id } });
    const status = await sys.unit.findUnique({ where: { id: unit.id }, select: { hkStatus: true } });
    record("back in service: no out-of-order period remains", left === 0, `found ${left}`);
    record("back in service: the freed dates are reported exactly once", reported === 1, `${reported} of ${RACERS}`);
    record("back in service: the room reads the new status", status?.hkStatus === "dirty", status?.hkStatus ?? "missing");
  } finally {
    await sys.roomInventoryPeriod.deleteMany({ where: { unitId: unit.id } });
    await sys.unit.update({ where: { id: unit.id }, data: { hkStatus: unit.hkStatus } });
    console.log(`\nCleaned up. Unit ${unit.label} restored to ${unit.hkStatus}.`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
