/**
 * Billing identities for the demo tenants, so the invoicing flow can be rehearsed end to end.
 *
 * They are fictional companies and look it — a real client's details are typed in by a person on the
 * client page. These exist because a billing flow that cannot be exercised is a billing flow nobody
 * has actually seen, and the demo tenants live in production precisely so it can be.
 *
 * Safe to re-run; it never touches a tenant that is not flagged demo.
 *
 *   DATABASE_URL=... pnpm --filter @revio/db demo-billing
 */
import { forSystem } from "../src/rls.js";

const DETAILS: Record<string, { legalName: string; vatId: string; companyId: string; addressLine: string; city: string; postCode: string; country: string; billingEmail: string }> = {
  "hotel-sofia": {
    legalName: "Hotel Sofia Group OOD", vatId: "BG200000001", companyId: "200000001",
    addressLine: "5 Alabin Street", city: "Sofia", postCode: "1000", country: "BG",
    billingEmail: "accounts@hotelsofia.demo",
  },
  "black-sea-resort": {
    legalName: "Black Sea Resort EOOD", vatId: "BG200000002", companyId: "200000002",
    addressLine: "1 Primorski Boulevard", city: "Varna", postCode: "9000", country: "BG",
    billingEmail: "accounts@blacksea.demo",
  },
  "belmar-partner-demo": {
    legalName: "Belmar Boutique Hotels SL", vatId: "ESB12345678", companyId: "B12345678",
    addressLine: "Carrer de Mallorca 240", city: "Barcelona", postCode: "08008", country: "ES",
    billingEmail: "accounts@belmar.demo",
  },
};

async function main() {
  const db = forSystem();
  for (const [slug, d] of Object.entries(DETAILS)) {
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true, name: true, isDemo: true } });
    if (!tenant) { console.warn(`  skip  ${slug} — no such tenant`); continue; }
    if (!tenant.isDemo) { console.warn(`  SKIP  ${slug} — NOT a demo tenant, refusing to invent legal details`); continue; }
    await db.clientBilling.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, ...d, attention: "Accounts payable" },
      update: d,
    });
    console.log(`  ok    ${tenant.name} → ${d.legalName} (${d.country})`);
  }
  // Belmar is Spanish on purpose: it exercises the EU reverse-charge branch, which is the treatment
  // most likely to be wrong and least likely to be noticed on a domestic-only test set.
  console.log("\nBelmar is ES, so its invoice reverse-charges — that branch gets exercised too.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { const { prisma } = await import("../src/client.js"); await prisma.$disconnect(); });
