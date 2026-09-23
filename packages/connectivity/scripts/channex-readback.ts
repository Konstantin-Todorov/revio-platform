/**
 * Read a live channel back from Channex and compare it with what Revio sends. READ-ONLY.
 *
 *   DATABASE_URL=… CHANNEX_PROD_KEY=… CHANNEX_SANDBOX_KEY=… CONNECTIVITY_SECRET=… \
 *     pnpm --filter @revio/connectivity exec tsx scripts/channex-readback.ts [channelId] [days]
 *
 * With no channel id it checks every connected non-mock channel. It never pushes, never acks a
 * revision, never writes a row — safe against a real hotel's production property, which is the
 * point: a sandbox run proves the code, and only a read of production proves production.
 *
 * It runs exactly what the Verify button runs (`verifyPublished` + `verifyPublishedAvailability`),
 * plus the property check and the unacknowledged-feed count. Written 2026-09-23, when its first run
 * found that Verify had never once completed against a real Channex (400, a missing parameter).
 */
import { forSystem, decryptSecret } from "@revio/db";
import { verifyChannelProperty, verifyPublished, verifyPublishedAvailability } from "../src/sync.js";
import { createChannelAdapter } from "../src/factory.js";

const db = forSystem();

async function keyFor(tenantId: string, mode: string): Promise<string> {
  const cred = await db.connectivityCredential.findUnique({ where: { tenantId_mode: { tenantId, mode } } });
  if (cred) return decryptSecret(cred.cipher);
  return (mode === "channex_prod" ? process.env.CHANNEX_PROD_KEY : process.env.CHANNEX_SANDBOX_KEY) ?? "";
}

async function main() {
  const [onlyId, daysArg] = process.argv.slice(2);
  const days = Number(daysArg ?? 30);
  const channels = await db.channel.findMany({
    where: { status: "connected", connectivityMode: { not: "mock" }, ...(onlyId ? { id: onlyId } : {}) },
    include: { property: { select: { name: true, tenant: { select: { name: true, isDemo: true } } } } },
  });
  let problems = 0;

  for (const ch of channels) {
    console.log(`\n=== ${ch.property.tenant.name}${ch.property.tenant.isDemo ? " (demo)" : ""} · ${ch.property.name} · ${ch.name} [${ch.connectivityMode}] ===`);

    const prop = await verifyChannelProperty(db, ch.id);
    console.log(`  property on Channex: ${prop.ok ? `ok (${prop.title ?? "untitled"})` : `FAIL — HTTP ${prop.status} ${prop.error ?? ""}`}`);
    if (!prop.ok) { problems++; continue; }

    const rates = await verifyPublished(db, ch.id, days);
    if (!rates.ok || !rates.summary) {
      problems++;
      console.log(`  prices: could not read — ${rates.error}`);
    } else {
      const s = rates.summary;
      if (s.mismatched + s.missing > 0) problems++;
      console.log(`  prices ${rates.from} → ${rates.to}: ${s.headline}`);
      for (const e of s.examples.slice(0, 6)) {
        const plan = rates.channelPlans?.[e.externalRateId];
        const why = plan?.derivedFrom ? ` (Channex derives this plan from ${plan.derivedFrom})` : "";
        console.log(`    ${e.kind} ${e.date} ${e.roomTypeName ?? plan?.name ?? e.externalRateId} · ours ${e.ours ?? "—"} theirs ${e.theirs ?? "—"}${why}`);
      }
    }

    const rooms = await verifyPublishedAvailability(db, ch.id, days);
    if (!rooms.ok) {
      problems++;
      console.log(`  availability: could not read — ${rooms.error}`);
    } else {
      if (rooms.mismatched > 0) problems++;
      console.log(`  availability: ${rooms.headline}`);
      for (const e of rooms.examples) console.log(`    ${e.roomTypeName} ${e.date}: ours ${e.ours} · theirs ${e.theirs ?? "—"}`);
    }

    // The feed: anything received and never acknowledged? Read only — nothing is acked here.
    const adapter = createChannelAdapter({
      mode: ch.connectivityMode === "channex_prod" ? "channex-prod" : "channex-sandbox",
      channelCode: ch.code,
      channex: { apiKey: await keyFor(ch.tenantId, ch.connectivityMode), propertyId: ch.externalPropertyId ?? "" },
    });
    try {
      const pending = await adapter.pullRevisions!();
      if (pending.length) problems++;
      console.log(`  unacknowledged bookings in the feed: ${pending.length}`);
    } catch (e) {
      problems++;
      console.log(`  feed: could not read — ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n${channels.length} channel(s) read · ${problems} problem(s)\n`);
  process.exit(problems ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
