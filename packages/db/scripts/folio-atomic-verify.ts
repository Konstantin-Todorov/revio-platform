/**
 * Does a failure partway through seeding a folio leave anything behind?
 *
 * ## What this is for
 *
 * `ensureFolio` in RevioPMS creates the folio row, then posts accommodation, then taxes and fees,
 * then a prepaid-OTA payment. Through the RLS proxy each of those was its own transaction, so a
 * crash partway committed everything before it — and because `ensureFolio` returns early when a
 * primary folio already exists, the retry found the half-built bill and handed it back. Permanent,
 * silent, and about a guest's money.
 *
 * It is wrapped in `withTenantTransaction` now. This proves the guarantee that wrapping relies on,
 * **on the real Folio table rather than by assertion**: a throw inside leaves no row.
 *
 * It also proves the advisory lock is takeable on the transaction client, which is not obvious —
 * `$executeRaw` does NOT exist on the RLS request proxy, and finding that out at runtime is what
 * broke the notification centre on 2026-09-14.
 *
 * ⚠️ It writes, so it refuses anything but a local database, and its own write is rolled back by
 * the very mechanism under test. Run:
 *
 *     DATABASE_URL=postgresql://localhost:5432/revio_dev \
 *     DIRECT_DATABASE_URL=$DATABASE_URL \
 *     pnpm --filter @revio/db folio-atomic-verify
 */
import { withTenantTransaction, forSystem } from "../src/index.js";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error(`folio-atomic-verify writes, so it only runs against a local database. DATABASE_URL="${url}"`);
  process.exit(1);
}

const prisma = forSystem();

const seed = await prisma.reservation.findFirst({ select: { id: true, tenantId: true, propertyId: true } });
if (!seed) { console.error("No reservation in this database to hang a folio off."); process.exit(1); }

const before = await prisma.folio.count();
let lockTaken = false;
let threw = false;

try {
  await withTenantTransaction(seed.tenantId, async (tx) => {
    // The same lock `ensureFolio` now takes. If `$executeRaw` were unavailable here this throws,
    // and that is worth knowing loudly rather than in production.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${seed.id}, 0))`;
    lockTaken = true;

    await tx.folio.create({
      data: {
        tenantId: seed.tenantId, propertyId: seed.propertyId, reservationId: seed.id,
        currency: "EUR", isPrimary: false, label: "atomicity probe",
      },
    });
    const inside = await tx.folio.count();
    console.log(`  inside the transaction: ${inside} folios — the row is really there`);

    // Exactly what a crash between creating the folio and posting its lines looks like.
    throw new Error("injected failure, mid-seed");
  });
} catch {
  threw = true;
}

const after = await prisma.folio.count();
const ok = threw && lockTaken && after === before;

console.log(`\nfolio-atomic-verify`);
console.log(`  advisory lock taken on the transaction client: ${lockTaken}`);
console.log(`  folios before: ${before} · after: ${after}`);
console.log(ok
  ? "  ✓ the failed seed left NOTHING behind — a half-built bill is not reachable this way\n"
  : "  ✗ the partial write SURVIVED — ensureFolio can still strand a guest with a wrong bill\n");

await prisma.$disconnect();
process.exit(ok ? 0 : 1);
