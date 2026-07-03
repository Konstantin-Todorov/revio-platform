/**
 * Fill the Channex SANDBOX test property with a realistic 30-day ARI dataset, so the staging
 * calendar (Inventory tab) shows real availability, rates and restrictions — the same push path
 * RevioLink uses in production, exercised against the live sandbox.
 *
 *   pnpm --filter @revio/connectivity channex:fill
 *
 * Reads the same env as the smoke test (CHANNEX_API_KEY / PROPERTY_ID / ROOM_TYPE_ID / RATE_PLAN_ID),
 * loaded from packages/connectivity/.env.local. Prices vary weekday/weekend; weekends carry a 2-night
 * minimum stay — enough to see restrictions land in the extranet.
 */

import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";
import type { AriUpdate } from "@revio/core";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY;
const propertyId = env.CHANNEX_PROPERTY_ID;
const roomTypeId = env.CHANNEX_ROOM_TYPE_ID;
const ratePlanId = env.CHANNEX_RATE_PLAN_ID;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;
const DAYS = Number(env.CHANNEX_FILL_DAYS ?? "30");

function ymd(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  if (!apiKey || !propertyId || !roomTypeId || !ratePlanId) {
    console.log("Missing env — set CHANNEX_API_KEY / PROPERTY_ID / ROOM_TYPE_ID / RATE_PLAN_ID (see .env.local).");
    return;
  }

  const adapter = new ChannexChannelAdapter({ apiKey, propertyId, baseUrl, channelCode: "channex-sandbox" });

  const updates: AriUpdate[] = Array.from({ length: DAYS }, (_, i) => {
    const date = ymd(i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = dow === 5 || dow === 6; // Fri/Sat
    return {
      externalRoomId: roomTypeId,
      externalRateId: ratePlanId,
      date,
      bookable: 8, // hold 2 of 10 back so overbooking is demonstrable
      priceMinor: weekend ? 15000 : 12000, // €150 weekend / €120 weekday
      currency: "EUR",
      restrictions: { minLos: weekend ? 2 : 1, stopSell: false, cta: false, ctd: false },
    };
  });

  console.log(`Pushing ${updates.length} days of ARI (${updates[0]!.date} … ${updates[updates.length - 1]!.date}) to the sandbox …`);
  const push = await adapter.pushAri(updates);
  console.log(`  ok=${push.ok}  pushed=${updates.length}  rejected=${push.rejected.length}`);
  for (const r of push.rejected) console.log(`  ✗ ${r.update.date}: ${r.reason}`);
  console.log(push.ok ? "\n✓ Sandbox calendar filled — open the Inventory tab in staging.channex.io to see it." : "\n✗ Push failed.");
}

main().catch((err) => {
  console.error("Fill failed:", err);
  process.exit(1);
});
