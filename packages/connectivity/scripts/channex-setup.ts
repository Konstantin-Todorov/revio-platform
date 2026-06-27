/**
 * One-shot setup of a Channex SANDBOX test property for the smoke test: creates a Property, a Room
 * Type, and a Rate Plan, then prints their UUIDs to paste into .env.local (CHANNEX_PROPERTY_ID /
 * ROOM_TYPE_ID / RATE_PLAN_ID).
 *
 *   CHANNEX_API_KEY=... pnpm --filter @revio/connectivity tsx scripts/channex-setup.ts
 *
 * Idempotency: re-running creates NEW objects (Channex has no upsert here) — run once per test property.
 */

import { CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const apiKey = process.env.CHANNEX_API_KEY;
const baseUrl = process.env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "user-api-key": apiKey!, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  if (!apiKey) {
    console.log("Set CHANNEX_API_KEY (sandbox) and re-run. Get one at https://staging.channex.io/organization/api-keys");
    return;
  }

  const property = await post("/properties", {
    property: { title: "Revio Test Hotel", currency: "EUR", country: "BG", timezone: "Europe/Sofia" },
  });
  const propertyId = property.data.id as string;

  const roomType = await post("/room_types", {
    room_type: {
      property_id: propertyId,
      title: "Deluxe Double",
      count_of_rooms: 10,
      occ_adults: 2,
      occ_children: 0,
      occ_infants: 0,
      default_occupancy: 2,
    },
  });
  const roomTypeId = roomType.data.id as string;

  const ratePlan = await post("/rate_plans", {
    rate_plan: {
      title: "Standard Rate",
      property_id: propertyId,
      room_type_id: roomTypeId,
      currency: "EUR",
      sell_mode: "per_room",
      rate_mode: "manual",
      options: [{ occupancy: 2, is_primary: true, rate: 0 }],
    },
  });
  const ratePlanId = ratePlan.data.id as string;

  console.log("Created sandbox test property. Add these to packages/connectivity/.env.local:\n");
  console.log(`CHANNEX_PROPERTY_ID="${propertyId}"`);
  console.log(`CHANNEX_ROOM_TYPE_ID="${roomTypeId}"`);
  console.log(`CHANNEX_RATE_PLAN_ID="${ratePlanId}"`);
  console.log("\nThen: pnpm --filter @revio/connectivity channex:smoke");
}

main().catch((err) => {
  console.error("Setup failed:", err.message ?? err);
  process.exit(1);
});
