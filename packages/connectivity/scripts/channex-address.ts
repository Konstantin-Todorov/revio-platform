/**
 * Bring the address on already-provisioned Channex properties in line with what the hotel told us.
 *
 *   DATABASE_URL=… CHANNEX_PROD_KEY=… CHANNEX_SANDBOX_KEY=… CONNECTIVITY_SECRET=… \
 *     pnpm --filter @revio/connectivity exec tsx scripts/channex-address.ts [--apply] [--include-real]
 *
 * Until 2026-09-30 every property was created on Channex with OUR town (Ruse, 7002) whatever town the
 * hotel was in; new properties get the right one (`channexAddress`). This fixes the ones made before.
 *
 * DRY RUN by default: it reads each property from Channex and prints what would change. `--apply`
 * writes. Only DEMO tenants unless `--include-real` — a real client's listing is theirs, and its
 * address is changed only when the founder says so for that client.
 */
import { forSystem, decryptSecret, hotelBillingIdentity } from "@revio/db";
import { CHANNEX_PROD_URL, CHANNEX_SANDBOX_URL } from "@revio/core";
import { channexAddress } from "../src/channex-provision.js";

const db = forSystem();
const apply = process.argv.includes("--apply");
const includeReal = process.argv.includes("--include-real");
const HOSTS: Record<string, string> = { channex_prod: CHANNEX_PROD_URL, channex_sandbox: CHANNEX_SANDBOX_URL };

async function keyFor(tenantId: string, mode: string): Promise<string> {
  const cred = await db.connectivityCredential.findUnique({ where: { tenantId_mode: { tenantId, mode } } });
  if (cred) return decryptSecret(cred.cipher);
  return (mode === "channex_prod" ? process.env.CHANNEX_PROD_KEY : process.env.CHANNEX_SANDBOX_KEY) ?? "";
}

async function main() {
  const channels = await db.channel.findMany({
    where: { connectivityMode: { in: ["channex_prod", "channex_sandbox"] }, externalPropertyId: { not: null } },
    include: { property: { select: { id: true, name: true, address: true, tenantId: true, tenant: { select: { name: true, isDemo: true } } } } },
  });
  // One Channex property can carry several channels — handle each property once.
  const seen = new Set<string>();
  let changed = 0, same = 0, skipped = 0, failed = 0;

  for (const ch of channels) {
    const key = `${ch.connectivityMode}:${ch.externalPropertyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `${ch.property.tenant.name}${ch.property.tenant.isDemo ? " (demo)" : ""} · ${ch.property.name} [${ch.connectivityMode}]`;
    if (!ch.property.tenant.isDemo && !includeReal) {
      console.log(`- ${label}: real client — left alone`);
      skipped++;
      continue;
    }
    const apiKey = await keyFor(ch.tenantId, ch.connectivityMode);
    const base = HOSTS[ch.connectivityMode]!;
    const headers = { "user-api-key": apiKey, "content-type": "application/json" };
    const res = await fetch(`${base}/properties/${ch.externalPropertyId}`, { headers });
    // The status decides, never the shape: a dead key is 401 with no `data`.
    if (!res.ok) {
      console.log(`! ${label}: could not read the property (HTTP ${res.status})`);
      failed++;
      continue;
    }
    const attrs = ((await res.json()) as { data?: { attributes?: Record<string, string | null> } }).data?.attributes ?? {};
    const billing = await hotelBillingIdentity(ch.property.tenantId);
    const want = channexAddress(ch.property.address, billing
      ? { addressLine: billing.addressLine || null, city: billing.city || null, postCode: billing.postCode || null, country: billing.country || null }
      : null);
    const diff = (["address", "city", "zip", "country", "state"] as const).filter((f) => (attrs[f] ?? "") !== want[f]);
    if (diff.length === 0) {
      console.log(`= ${label}: already right (${want.city} ${want.zip})`);
      same++;
      continue;
    }
    console.log(`~ ${label}:`);
    for (const f of diff) console.log(`    ${f}: "${attrs[f] ?? ""}" → "${want[f]}"`);
    if (!apply) continue;
    const put = await fetch(`${base}/properties/${ch.externalPropertyId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ property: want }),
    });
    if (put.ok) {
      console.log("    written");
      changed++;
    } else {
      console.log(`    REFUSED — HTTP ${put.status} ${(await put.text()).slice(0, 200)}`);
      failed++;
    }
  }
  console.log(`\n${apply ? "Applied" : "Dry run"}: ${changed} written · ${same} already right · ${skipped} real clients left alone · ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
