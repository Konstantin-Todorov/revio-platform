/**
 * One-off, 2026-09-28: classify the two non-demo production clients the founder decided on, and
 * write down what happened to DesManagement before the console kept a history.
 *
 *   - DesManagement 2015 → Pilot, free until 2026-12-28 ("пилот е и сложи дата след 3 месеца").
 *   - Ventsi Group       → Test ("с реални данни правихме тестове").
 *
 * The three demo tenants were classified by the migration itself.
 *
 * DRY RUN unless `--apply`. Everything is one transaction. Take a backup first
 * (`packages/db/scripts/backup.sh`, or the pre-push hook on a migrating push).
 *
 *   DATABASE_URL=<public url> pnpm --filter @revio/db exec tsx scripts/client-lifecycle-backfill.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const db = new PrismaClient();
const ACTOR = "Revio Operator";
const DECISION = "Founder decision, 28 Sept 2026";

async function main() {
  const des = await db.tenant.findFirst({ where: { name: "DesManagement 2015" } });
  const ventsi = await db.tenant.findFirst({ where: { name: "Ventsi Group" } });
  if (!des || !ventsi) throw new Error(`missing tenant: des=${!!des} ventsi=${!!ventsi}`);

  const desDrafts = await db.invoice.findMany({ where: { tenantId: des.id, status: "draft", number: null }, select: { period: true, amountMinor: true } });
  const withdrawn = await db.auditEntry.findMany({
    where: { tenantId: des.id, entity: "Product access", newValue: { startsWith: "withdrawn" } },
    orderBy: { createdAt: "asc" },
    select: { field: true, createdAt: true },
  });

  console.log(APPLY ? "APPLYING" : "DRY RUN — nothing is written");
  console.log(`DesManagement 2015: ${des.accountType}/${des.billingMode} → pilot/free until 2026-12-28; status stays ${des.status}`);
  console.log(`  drafts removed: ${desDrafts.map((d) => `${d.period} €${(d.amountMinor / 100).toFixed(2)}`).join(", ") || "none"}`);
  console.log(`  history written afterwards: ${withdrawn.length} product withdrawals + the suspension (time unknown)`);
  console.log(`Ventsi Group: ${ventsi.accountType}/${ventsi.billingMode} → test/none; status stays ${ventsi.status}`);
  if (!APPLY) return;

  await db.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: des.id },
      data: { accountType: "pilot", isDemo: false, billingMode: "free", freeUntil: new Date("2026-12-28T00:00:00Z"), billingNote: `Pilot — ${DECISION}.` },
    });
    await tx.invoice.deleteMany({ where: { tenantId: des.id, status: "draft", number: null } });
    // What happened on 26 Sept, recorded as it is known: the times are from the hotel's own audit log;
    // the suspension's time was never written anywhere, and this says so rather than inventing one.
    for (const w of withdrawn) {
      await tx.clientEvent.create({
        data: {
          tenantId: des.id, kind: "product", fromValue: `${w.field} on`, toValue: `${w.field} off`, at: w.createdAt,
          reason: "Recorded afterwards from the hotel's audit log — no reason was given at the time.", actorName: `${ACTOR} (shared login)`,
        },
      });
    }
    await tx.clientEvent.create({
      data: {
        tenantId: des.id, kind: "status", fromValue: "active", toValue: "suspended",
        reason: "Suspended on or around 26 Sept 2026 — not recorded at the time, so the exact time and reason are unknown.",
        actorName: `${ACTOR} (shared login)`, // dated today: the real time is unknown, and a guessed one would read as fact
      },
    });
    await tx.clientEvent.create({
      data: { tenantId: des.id, kind: "type", fromValue: "Live client", toValue: "Pilot", reason: DECISION, actorName: ACTOR },
    });
    await tx.clientEvent.create({
      data: { tenantId: des.id, kind: "billing", fromValue: "Paying", toValue: "Free until 2026-12-28", reason: DECISION, actorName: ACTOR },
    });

    await tx.tenant.update({ where: { id: ventsi.id }, data: { accountType: "test", isDemo: true, billingMode: "none", freeUntil: null } });
    await tx.invoice.deleteMany({ where: { tenantId: ventsi.id, status: "draft", number: null } });
    await tx.clientEvent.create({
      data: { tenantId: ventsi.id, kind: "type", fromValue: "Live client", toValue: "Test", reason: `${DECISION}: tested with real data`, actorName: ACTOR },
    });
  });
  console.log("done");
}

main().finally(() => db.$disconnect());
