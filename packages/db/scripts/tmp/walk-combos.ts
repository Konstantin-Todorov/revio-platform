// Seven brand-new hotels, one per product combination, made the way Operator's createClient makes
// them. Local only — scratch, not committed.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const COMBOS: [string, boolean, boolean, boolean][] = [
  ["cm", true, false, false], ["crs", false, true, false], ["pms", false, false, true],
  ["cm-crs", true, true, false], ["cm-pms", true, false, true], ["crs-pms", false, true, true],
  ["all", true, true, true],
];
async function main() {
  for (const [code, cm, crs, pms] of COMBOS) {
    const slug = `walk-${code}`;
    let t = await prisma.tenant.findUnique({ where: { slug }, include: { users: true } });
    if (!t) {
      t = await prisma.tenant.create({
        data: {
          name: `Walk ${code.toUpperCase()}`, slug, plan: "starter", status: "active",
          hasChannelManager: cm, hasReservation: crs, hasPms: pms,
          users: { create: [{ name: `Owner ${code}`, email: `owner-${code}@walk.test`, role: "owner", locale: "bg" }] },
          properties: { create: [{ name: `Walk property ${code}`, baseCurrency: "EUR", timezone: "Europe/Sofia", defaultLanguage: "bg" }] },
        },
        include: { users: true, properties: true },
      });
      await prisma.ratePlan.create({
        data: { tenantId: t.id, propertyId: (t as any).properties[0].id, name: "Standard Rate", code: "BAR", tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0 },
      });
    }
    console.log(`${code} ${t.users[0]!.id}`);
  }
}
main().finally(() => prisma.$disconnect());
