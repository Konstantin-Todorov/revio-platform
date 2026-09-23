/**
 * Proves the shared first-run writes do what the three copies they replaced did not.
 *
 *   pnpm --filter @revio/db welcome-writes-verify
 *
 * Runs against a LOCAL database only, on a throwaway hotel it creates and removes. Each check is one
 * of the divergences found when the copies were compared on 2026-09-23 — so each would have FAILED
 * against at least one of the old copies.
 */
import { todayInTimeZone } from "@revio/core";
import { prisma } from "../src/client.js";
import { withSystemTransaction } from "../src/rls.js";
import { writeWelcomePrice, writeWelcomeRoomType, writeWelcomeTaxes } from "../src/welcome-writes.js";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`welcome-writes-verify writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const checks: { name: string; ok: boolean }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const stamp = Date.now();
  // A timezone far enough east that its "today" differs from UTC's for half of every day — the
  // property-today rule is only testable where the two disagree some of the time, and this one is
  // checked against the zone's own date rather than assumed to differ.
  const timezone = "Pacific/Kiritimati";
  const { tenantId, propertyId } = await withSystemTransaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: `Welcome Verify ${stamp}`, slug: `welcome-verify-${stamp}` } });
    const property = await tx.property.create({ data: { tenantId: tenant.id, name: "Welcome Verify Hotel", timezone } });
    // A plan that exists BEFORE the room type — the PMS-first hotel whose later rooms were unlinked.
    await tx.ratePlan.create({ data: { tenantId: tenant.id, propertyId: property.id, name: "Standard", code: "STD", active: true, priceLogic: "manual" } });
    await tx.ratePlan.create({ data: { tenantId: tenant.id, propertyId: property.id, name: "Flex", code: "FLX", active: true, priceLogic: "manual", sortOrder: 1 } });
    return { tenantId: tenant.id, propertyId: property.id };
  });
  const scope = { tenantId, propertyId };

  try {
    // 1. A room type is sellable under every existing plan, whichever product created it.
    const added = await writeWelcomeRoomType(scope, { name: "Double Room", totalRooms: "4", maxGuests: "2" });
    const links = await withSystemTransaction((tx) => tx.ratePlanRoomType.count({ where: { roomType: { propertyId } } }));
    record("a new room type is linked to every existing rate plan", !added.error && links === 2, `${links}/2 plans link it`);

    // 2. Every active manual plan is priced, from the PROPERTY'S today.
    const priced = await writeWelcomePrice({ ...scope, timezone }, { price: "120", rateScreen: "Rooms & Rates" });
    const [first, perPlan] = await withSystemTransaction(async (tx) => [
      await tx.ratePrice.findFirst({ where: { propertyId }, orderBy: { date: "asc" }, select: { date: true, occupancy: true } }),
      await tx.ratePrice.groupBy({ by: ["ratePlanId"], where: { propertyId }, _count: true }),
    ] as const);
    record("every active manual plan got a price", !priced.error && perPlan.length === 2 && perPlan.every((g) => g._count === 180), perPlan.map((g) => g._count).join(" · "));
    const expected = todayInTimeZone(timezone);
    record("the season starts on the property's own today", first?.date.toISOString().slice(0, 10) === expected, `first ${first?.date.toISOString().slice(0, 10)} · property today ${expected} · UTC today ${new Date().toISOString().slice(0, 10)}`);
    record("every price row carries an occupancy", first?.occupancy === 2, `occupancy ${first?.occupancy}`);

    // 3. A second pass that writes nothing says so — and does not move the plan defaults either.
    const again = await writeWelcomePrice({ ...scope, timezone }, { price: "99", rateScreen: "Rooms & Rates" });
    const defaults = await withSystemTransaction((tx) => tx.ratePlanOccupancy.findMany({ where: { ratePlan: { propertyId } }, select: { rateMinor: true } }));
    record(
      "\"nothing was changed\" is true: the plan defaults did not move either",
      Boolean(again.error) && defaults.length === 2 && defaults.every((d) => d.rateMinor === 12000),
      defaults.map((d) => d.rateMinor).join(" · "),
    );

    // 4. Taxes: a second pass updates the city tax in place, clearing it deactivates it.
    await writeWelcomeTaxes(scope, { vatStandardPct: "20", vatReducedPct: "9", cityTax: "1,5", invoiceIssuerName: "WV Ltd", invoiceVatId: "BG1", invoiceAddress: "Sofia" });
    await writeWelcomeTaxes(scope, { vatStandardPct: "20", vatReducedPct: "9", cityTax: "2", invoiceIssuerName: "WV Ltd", invoiceVatId: "BG1", invoiceAddress: "Sofia" });
    const fees = await withSystemTransaction((tx) => tx.taxFee.findMany({ where: { propertyId }, select: { amountMinor: true, active: true } }));
    record("city tax is updated in place, not added twice", fees.length === 1 && fees[0]!.amountMinor === 200 && fees[0]!.active, `${fees.length} fee(s)`);
    await writeWelcomeTaxes(scope, { vatStandardPct: "20", vatReducedPct: "9", cityTax: "", invoiceIssuerName: "WV Ltd", invoiceVatId: "BG1", invoiceAddress: "Sofia" });
    const cleared = await withSystemTransaction((tx) => tx.taxFee.findMany({ where: { propertyId }, select: { active: true } }));
    record("clearing the city tax deactivates it rather than deleting it", cleared.length === 1 && !cleared[0]!.active);
  } finally {
    await withSystemTransaction(async (tx) => {
      await tx.ratePrice.deleteMany({ where: { propertyId } });
      await tx.ratePlanOccupancy.deleteMany({ where: { ratePlan: { propertyId } } });
      await tx.ratePlanRoomType.deleteMany({ where: { roomType: { propertyId } } });
      await tx.taxFee.deleteMany({ where: { propertyId } });
      await tx.propertyDefaults.deleteMany({ where: { propertyId } });
      await tx.roomType.deleteMany({ where: { propertyId } });
      await tx.ratePlan.deleteMany({ where: { propertyId } });
      await tx.property.delete({ where: { id: propertyId } });
      await tx.tenant.delete({ where: { id: tenantId } });
    });
    console.log("\nCleaned up.");
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
