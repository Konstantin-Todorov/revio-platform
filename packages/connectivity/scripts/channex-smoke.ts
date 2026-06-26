/**
 * Live smoke test against the Channex SANDBOX (https://staging.channex.io).
 *
 * Proves the adapter end-to-end with your own test key: pushes ARI for the next few days, then pulls
 * bookings back — the real `edit → push → … → pull` loop against Channex, no app/DB involved.
 *
 * Get a free sandbox account + key at https://staging.channex.io/user_profile, create a Property with a
 * Room Type and Rate Plan in the staging extranet, then run:
 *
 *   CHANNEX_API_KEY=...        \
 *   CHANNEX_PROPERTY_ID=...    \   # Property UUID
 *   CHANNEX_ROOM_TYPE_ID=...   \   # Room Type UUID
 *   CHANNEX_RATE_PLAN_ID=...   \   # Rate Plan UUID
 *   pnpm --filter @revio/connectivity channex:smoke
 */

import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";
import type { AriUpdate } from "@revio/core";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY;
const propertyId = env.CHANNEX_PROPERTY_ID;
const roomTypeId = env.CHANNEX_ROOM_TYPE_ID;
const ratePlanId = env.CHANNEX_RATE_PLAN_ID;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

function ymd(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!apiKey || !propertyId || !roomTypeId || !ratePlanId) {
    console.log(
      [
        "Channex smoke test — missing env. Set these and re-run:",
        "  CHANNEX_API_KEY       (user profile → API key)",
        "  CHANNEX_PROPERTY_ID   (Property UUID)",
        "  CHANNEX_ROOM_TYPE_ID  (Room Type UUID)",
        "  CHANNEX_RATE_PLAN_ID  (Rate Plan UUID)",
        "  CHANNEX_BASE_URL      (optional; defaults to the sandbox)",
        "",
        `Sandbox: https://staging.channex.io/user_profile   ·   base: ${baseUrl}`,
      ].join("\n"),
    );
    return;
  }

  const adapter = new ChannexChannelAdapter({ apiKey, propertyId, baseUrl, channelCode: "channex-sandbox" });
  console.log(`→ Channex sandbox @ ${baseUrl}\n   property=${propertyId}\n`);

  // 1) Push ARI for the next 3 days: a price, availability, and a couple of restrictions.
  const updates: AriUpdate[] = [0, 1, 2].map((i) => ({
    externalRoomId: roomTypeId,
    externalRateId: ratePlanId,
    date: ymd(i),
    bookable: 5,
    priceMinor: 12000 + i * 1000,
    currency: "EUR",
    restrictions: { minLos: 2, stopSell: false, cta: false, ctd: false },
  }));

  console.log(`Pushing ARI for ${updates[0]!.date} … ${updates[updates.length - 1]!.date} …`);
  const push = await adapter.pushAri(updates);
  console.log(`  ok=${push.ok}  rejected=${push.rejected.length}  responseId=${push.channelResponseId ?? "—"}`);
  for (const r of push.rejected) console.log(`  ✗ ${r.update.date}: ${r.reason}`);

  // 2) Pull bookings imported in the last 60 days.
  const since = ymd(-60) + "T00:00:00";
  console.log(`\nPulling bookings since ${since} …`);
  const bookings = await adapter.pullReservations(since);
  console.log(`  ${bookings.length} booking(s) returned`);
  for (const b of bookings.slice(0, 5)) {
    console.log(`  • ${b.externalId}  ${b.status}  ${b.guestName}  ${(b.totalMinor / 100).toFixed(2)} ${b.currency}  (${b.lines.length} room-night line[s])`);
  }

  console.log("\n✓ Smoke test complete — the adapter pushed to and pulled from the real Channex sandbox.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
