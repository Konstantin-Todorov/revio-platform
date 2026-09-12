import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { TENANT_TABLES_WITHOUT_CASCADE } from "@revio/core";

/**
 * ⚠️ The list of tables a tenant delete misses is checked against the DATABASE, not maintained by hand.
 *
 * `DELETE FROM "Tenant"` cascades to 55 tables. Six more carry `tenantId` as a plain column with no
 * foreign key — the RLS pattern needs the column, not the constraint — so they are left behind as
 * rows belonging to a hotel that no longer exists. Two of those matter a great deal:
 * `ConnectivityCredential` holds encrypted OTA credentials, and `Invoice` is an accounting record.
 *
 * A hand-maintained list of six would be correct today and wrong the first time somebody adds a
 * tenant-scoped model — silently, because orphaned rows raise no error and RLS hides them. So this
 * asks Postgres to recompute the set from the real constraint graph and fails when it stops
 * matching. The build breaks; the rows do not leak.
 */

const RAW_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const name = (() => {
  try { return RAW_URL ? new URL(RAW_URL).pathname.replace(/^\//, "") : ""; } catch { return ""; }
})();
// Read-only, so any migrated database will do — including a seeded one.
const usable = Boolean(RAW_URL && name);
const prisma = usable && RAW_URL ? new PrismaClient({ datasources: { db: { url: RAW_URL } } }) : null;

let reachable = false;
beforeAll(async () => {
  if (!prisma) return;
  try { await prisma.$queryRaw`SELECT 1`; reachable = true; } catch { reachable = false; }
});
afterAll(async () => { await prisma?.$disconnect(); });

(usable ? describe : describe.skip)("what a tenant delete leaves behind", () => {
  it("matches TENANT_TABLES_WITHOUT_CASCADE exactly", async () => {
    if (!reachable) return;

    const rows = await prisma!.$queryRawUnsafe<{ table_name: string }[]>(`
      WITH RECURSIVE reach(t) AS (
        SELECT '"Tenant"'::regclass::oid
        UNION
        SELECT con.conrelid FROM pg_constraint con JOIN reach r ON con.confrelid = r.t
        WHERE con.contype = 'f' AND con.confdeltype = 'c'
      ),
      reached AS (SELECT replace(t::regclass::text, '"', '') AS name FROM reach),
      tenant_scoped AS (
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'tenantId' AND table_schema = 'public'
      )
      SELECT table_name FROM tenant_scoped
      WHERE table_name NOT IN (SELECT name FROM reached)
      ORDER BY table_name
    `);

    const actual = rows.map((r) => r.table_name).sort();
    const declared = [...TENANT_TABLES_WITHOUT_CASCADE].sort();

    expect(
      actual,
      "A tenant-scoped table's relationship to the cascade changed. Add it to (or remove it from) " +
        "TENANT_TABLES_WITHOUT_CASCADE in packages/core/src/billing/client-deletion.ts — a table " +
        "missing from that list is rows left behind when a client is deleted, and nothing errors.",
    ).toEqual(declared);
  });

  it("still includes the two that make this more than untidiness", async () => {
    if (!reachable) return;
    // Encrypted OTA credentials and accounting records are exactly what a deletion must remove.
    expect(TENANT_TABLES_WITHOUT_CASCADE).toContain("ConnectivityCredential");
    expect(TENANT_TABLES_WITHOUT_CASCADE).toContain("Invoice");
  });
});
