/**
 * Proves the database — not the application — is what keeps two hotels apart.
 *
 * Every check here runs as the restricted `revio_app` role, because that is the only condition under
 * which any of it means anything: Postgres ignores RLS for superusers, and `FORCE` only reaches the
 * table owner. Run it as the owner and every assertion below passes for the wrong reason, which is
 * precisely the mistake this script exists to make impossible — so it refuses to run as a role that
 * can bypass policies.
 *
 *   DATABASE_URL="postgresql://revio_app:...@host/db" pnpm --filter @revio/db rls-verify
 *
 * It is a release gate for R3, not a unit test: run it against a database BEFORE pointing an app at
 * it with the restricted role, and again after.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/client.js";
import { forSystem, forTenant, withTenantTransaction } from "../src/rls.js";

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Models keyed by their own id rather than a tenantId column (the Tenant row IS the tenant). */
const SELF_KEYED = new Set(["Tenant"]);
/** Operator-perimeter tables: invisible to a hotel connection by design, so "0 rows" is a pass. */
const OPERATOR_ONLY = new Set(["ConnectivityCredential", "Invoice", "OperatorUser"]);

async function main() {
  const [{ current_user: role, is_super: isSuper, bypass }] = await prisma.$queryRaw<
    { current_user: string; is_super: boolean; bypass: boolean }[]
  >(Prisma.sql`
    SELECT current_user, rolsuper AS is_super, rolbypassrls AS bypass
    FROM pg_roles WHERE rolname = current_user
  `);
  console.log(`\nConnected as "${role}" (superuser=${isSuper}, bypassrls=${bypass})\n`);
  if (isSuper || bypass) {
    console.error(
      `REFUSING TO RUN: "${role}" can bypass row-level security, so every check below would pass\n` +
        `without proving anything. Point DATABASE_URL at the restricted app role and re-run.`,
    );
    process.exit(2);
  }

  const models = Prisma.dmmf.datamodel.models;
  const tenantOwned = models.filter(
    (m) => SELF_KEYED.has(m.name) || m.fields.some((f) => f.name === "tenantId"),
  );

  const sys = forSystem();
  const tenants = await sys.tenant.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  if (tenants.length < 2) {
    console.error(`REFUSING TO RUN: need at least two tenants to prove isolation, found ${tenants.length}.`);
    process.exit(2);
  }
  const [A, B] = tenants;
  console.log(`Tenant A = ${A.name}\nTenant B = ${B.name}\n`);

  // 1. Fail-closed: the unscoped client sets no GUC at all, so it is entitled to nothing.
  console.log("— with no tenant context (the shape of a code path that forgot to scope) —");
  for (const m of tenantOwned) {
    const key = m.name.charAt(0).toLowerCase() + m.name.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await (prisma as any)[key].count();
    record(`${m.name}: no context sees nothing`, n === 0, `${n} rows`);
  }

  // 2. Scoped reads: A sees only A. Compared against the true totals read under bypass, so a table
  //    that is simply empty cannot masquerade as a table that is correctly isolated.
  console.log("\n— scoped to tenant A —");
  const dbA = forTenant(A.id);
  let coveredNonEmpty = 0;
  for (const m of tenantOwned) {
    const key = m.name.charAt(0).toLowerCase() + m.name.slice(1);
    const where = SELF_KEYED.has(m.name) ? { id: B.id } : { tenantId: B.id };
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const total = await (sys as any)[key].count();
    const seen = await (dbA as any)[key].count();
    const leaked = await (dbA as any)[key].count({ where });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (OPERATOR_ONLY.has(m.name)) {
      record(`${m.name}: operator-only, hidden from a hotel`, seen === 0, `${seen} of ${total} rows`);
      continue;
    }
    if (total > 0) coveredNonEmpty++;
    record(
      `${m.name}: A sees only A`,
      leaked === 0 && seen <= total,
      `${seen} of ${total} rows, ${leaked} of B's`,
    );
  }

  // 3. Writes are policed too. A SELECT-only policy would let one tenant plant rows in another's
  //    account — the WITH CHECK half is what makes that impossible.
  console.log("\n— writing across the perimeter —");
  const propB = await sys.property.findFirstOrThrow({ where: { tenantId: B.id }, select: { id: true } });
  const propA = await sys.property.findFirstOrThrow({ where: { tenantId: A.id }, select: { id: true } });
  let rejected = false;
  let detail = "no error raised — the row was written";
  try {
    await dbA.auditEntry.create({
      data: { tenantId: B.id, propertyId: propB.id, entity: "rls-verify", source: "rls-verify" },
    });
  } catch (e) {
    rejected = /row-level security/i.test(String(e));
    detail = rejected ? "rejected by row-level security policy" : `rejected, but not by RLS: ${String(e).slice(0, 120)}`;
  }
  record("INSERT tagged with another tenant's id is refused", rejected, detail);
  const planted = await sys.auditEntry.count({ where: { entity: "rls-verify" } });
  record("nothing was actually planted in B's account", planted === 0, `${planted} stray rows`);

  // 4. The one table with no policy at all would be invisible here, so assert coverage directly
  //    rather than inferring it from the checks above.
  const uncovered = await prisma.$queryRaw<{ relname: string }[]>(Prisma.sql`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      AND c.relname <> '_prisma_migrations'
    ORDER BY 1
  `);
  record(
    "every table in the database has RLS enabled",
    uncovered.length === 0,
    uncovered.length ? uncovered.map((u) => u.relname).join(", ") : "none missing",
  );

  // 5. `withTenantTransaction` hands its callback a PLAIN Prisma tx client — not one of the extended
  //    clients — so its isolation rests entirely on the GUC being set as the transaction's first
  //    statement. That is exactly the kind of claim that is easy to state and easy to get wrong, and
  //    getting it wrong would hand a hotel request an unscoped connection. So prove it, three ways.
  const txSeesOwnOnly = await withTenantTransaction(A.id, async (tx) => {
    const mine = await tx.auditEntry.count();
    const theirs = await tx.auditEntry.count({ where: { tenantId: B.id } });
    return { mine, theirs };
  });
  record(
    "withTenantTransaction: the callback's client is scoped to its tenant",
    txSeesOwnOnly.theirs === 0,
    `${txSeesOwnOnly.theirs} of tenant B's rows visible inside A's transaction`,
  );

  let txCrossTenantRejected = false;
  let txDetail = "no error raised — the row was written";
  try {
    await withTenantTransaction(A.id, async (tx) => {
      await tx.auditEntry.create({
        data: { tenantId: B.id, propertyId: propB.id, entity: "rls-verify-tx", source: "rls-verify" },
      });
    });
  } catch (e) {
    txCrossTenantRejected = /row-level security/i.test(String(e));
    txDetail = txCrossTenantRejected
      ? "rejected by row-level security policy"
      : `rejected, but not by RLS: ${String(e).slice(0, 120)}`;
  }
  record("withTenantTransaction: a cross-tenant INSERT is still refused", txCrossTenantRejected, txDetail);

  // The whole point of the helper: a throw must undo the writes that already succeeded. Without this,
  // callers get the same partial commit they had before, only harder to see.
  const before = await sys.auditEntry.count({ where: { entity: "rls-verify-rollback" } });
  await withTenantTransaction(A.id, async (tx) => {
    await tx.auditEntry.create({
      data: { tenantId: A.id, propertyId: propA.id, entity: "rls-verify-rollback", source: "rls-verify" },
    });
    throw new Error("deliberate rollback");
  }).catch(() => undefined);
  const after = await sys.auditEntry.count({ where: { entity: "rls-verify-rollback" } });
  record(
    "withTenantTransaction: a throw rolls back writes that already succeeded",
    after === before,
    after === before ? "nothing committed" : `${after - before} row(s) survived the rollback`,
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed ` +
      `(${coveredNonEmpty} tenant tables held real rows and were proven isolated).`,
  );
  if (failed.length) {
    console.error(`\nFAILED:\n${failed.map((f) => `  - ${f.name}: ${f.detail}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Tenant isolation is enforced by Postgres, not by application code.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
