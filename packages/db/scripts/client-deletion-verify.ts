/**
 * Proves a client can be deleted after it has taken a booking — against a real database.
 *
 *   pnpm --filter @revio/db client-deletion-verify
 *
 * On 2026-09-26 deleting a real, suspended client crashed the operator console: a reservation line
 * RESTRICTs its room type and rate plan, and Postgres checks that as soon as the tenant cascade
 * reaches the room type — before it reaches the line. The unit tests could not see it (no database)
 * and the constraint test only asked which tables the cascade MISSES, not which ones it trips on.
 *
 * Two checks, each of which FAILED before the fix:
 *   1. the live constraint graph has no RESTRICT foreign key inside the tenant's cascade that
 *      TENANT_TABLES_DELETED_FIRST does not clear first;
 *   2. a throwaway hotel with a room type, a rate plan and a booking is actually deleted.
 *
 * Runs against a LOCAL database only, on a throwaway hotel it creates.
 */
import { TENANT_TABLES_DELETED_FIRST } from "@revio/core";
import { prisma } from "../src/client.js";
import { withSystemTransaction } from "../src/rls.js";
import { deleteClientCompletely } from "../src/client-deletion.js";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`client-deletion-verify writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const checks: { name: string; ok: boolean }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  // 1. Every RESTRICT/NO ACTION foreign key whose parent the tenant cascade deletes must have its
  //    child reachable, by cascade, from a table we empty first. Otherwise the delete trips on it.
  const blocking = await prisma.$queryRawUnsafe<{ child: string; parent: string; cleared: boolean }[]>(`
    WITH RECURSIVE reach(t) AS (
      SELECT '"Tenant"'::regclass::oid
      UNION
      SELECT con.conrelid FROM pg_constraint con JOIN reach r ON con.confrelid = r.t
      WHERE con.contype = 'f' AND con.confdeltype = 'c'
    ),
    first(t) AS (
      SELECT to_regclass(format('%I', name))::oid FROM unnest($1::text[]) AS name
      UNION
      SELECT con.conrelid FROM pg_constraint con JOIN first f ON con.confrelid = f.t
      WHERE con.contype = 'f' AND con.confdeltype = 'c'
    )
    SELECT con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent,
           con.conrelid IN (SELECT t FROM first) AS cleared
    FROM pg_constraint con
    WHERE con.contype = 'f' AND con.confdeltype IN ('r', 'a')
      AND con.confrelid IN (SELECT t FROM reach)
  `, [...TENANT_TABLES_DELETED_FIRST]);
  const uncleared = blocking.filter((b) => !b.cleared);
  record(
    "every RESTRICT foreign key in a client's cascade is cleared first",
    uncleared.length === 0,
    uncleared.length
      ? `not cleared: ${uncleared.map((b) => `${b.child} → ${b.parent}`).join(", ")} — add its table to TENANT_TABLES_DELETED_FIRST`
      : `${blocking.length} checked`,
  );

  // 2. The real thing: a hotel that has taken a booking can be removed.
  const stamp = Date.now();
  const name = `Deletion Verify ${stamp}`;
  const tenantId = await withSystemTransaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name, slug: `deletion-verify-${stamp}`, isDemo: true } });
    const property = await tx.property.create({ data: { tenantId: tenant.id, name: "Deletion Verify Hotel", timezone: "Europe/Sofia" } });
    const base = { tenantId: tenant.id, propertyId: property.id };
    const room = await tx.roomType.create({ data: { ...base, name: "Double", code: "DBL", totalRooms: 2, maxGuests: 2 } });
    const plan = await tx.ratePlan.create({ data: { ...base, name: "Standard", code: "STD", tags: [] } });
    await tx.reservation.create({
      data: {
        ...base, guestName: "Verify Guest", totalMinor: 20000,
        lines: { create: { roomTypeId: room.id, ratePlanId: plan.id, checkIn: new Date("2030-01-10"), checkOut: new Date("2030-01-12"), priceMinor: 20000 } },
      },
    });
    return tenant.id;
  });

  let result: Awaited<ReturnType<typeof deleteClientCompletely>> | null = null;
  let thrown: unknown = null;
  try {
    result = await deleteClientCompletely({ tenantId, confirmation: name, operatorUserId: "verify", operatorName: "client-deletion-verify" });
  } catch (e) {
    thrown = e;
  }
  const left = await withSystemTransaction((tx) => tx.tenant.count({ where: { id: tenantId } }));
  record(
    "a client with a booking is deleted, not crashed on",
    !thrown && result?.ok === true && left === 0,
    thrown ? String(thrown).split("\n").find((l) => l.includes("violates")) ?? String(thrown).slice(0, 200) : `removed ${JSON.stringify(result?.removed ?? {})}`,
  );

  // Leave nothing behind whatever happened above.
  if (left > 0) {
    await withSystemTransaction(async (tx) => {
      await tx.reservation.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });
    });
  }
  await withSystemTransaction((tx) => tx.deletedClient.deleteMany({ where: { tenantName: name } }));
}

main()
  .catch((e) => { console.error(e); checks.push({ name: "harness", ok: false }); })
  .finally(async () => {
    await prisma.$disconnect();
    const failed = checks.filter((c) => !c.ok).length;
    console.log(failed ? `\nclient-deletion-verify: ${failed} failed` : `\nclient-deletion-verify: ${checks.length}/${checks.length} ok`);
    process.exit(failed ? 1 : 0);
  });
