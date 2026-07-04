/**
 * Build the Channex SANDBOX property up to the PMS-certification data model:
 *   2 room types (Double Room, Twin Room) × 2 rate plans each (Best Available Rate, Breakfast)
 *   = 4 rate plans — the exact shape Channex's certification tests expect.
 *
 *   pnpm --filter @revio/connectivity channex:cert-setup
 *
 * Reuses the existing property + its first room type/rate plan (renamed), then adds the rest.
 * Prints every id to paste into .env.local. Safe to re-run: it skips objects whose title already
 * exists (so you don't get duplicates).
 */

import { CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const apiKey = process.env.CHANNEX_API_KEY!;
const baseUrl = process.env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;
const propertyId = process.env.CHANNEX_PROPERTY_ID!;

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "user-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function listRoomTypes() {
  const j = await api("GET", `/room_types?filter[property_id]=${propertyId}`);
  return (j.data ?? []).map((r: any) => ({ id: r.id, title: r.attributes.title }));
}
async function listRatePlans() {
  const j = await api("GET", `/rate_plans?filter[property_id]=${propertyId}`);
  return (j.data ?? []).map((r: any) => ({ id: r.id, title: r.attributes.title, roomTypeId: r.attributes.room_type_id }));
}
/** The property list endpoint omits room_type_id; this per-room filter returns it reliably, so
 *  re-runs match existing plans instead of creating duplicates. */
async function listRatePlansForRoom(roomTypeId: string) {
  const j = await api("GET", `/rate_plans?filter[room_type_id]=${roomTypeId}`);
  return (j.data ?? []).map((r: any) => ({ id: r.id, title: r.attributes.title, roomTypeId }));
}

async function ensureRoomType(title: string, rooms: number, existing: { id: string; title: string }[]): Promise<string> {
  const hit = existing.find((r) => r.title === title);
  if (hit) return hit.id;
  const j = await api("POST", "/room_types", {
    room_type: { property_id: propertyId, title, count_of_rooms: rooms, occ_adults: 2, occ_children: 0, occ_infants: 0, default_occupancy: 2 },
  });
  return j.data.id as string;
}

async function ensureRatePlan(title: string, roomTypeId: string, existing: { id: string; title: string; roomTypeId: string }[]): Promise<string> {
  const hit = existing.find((r) => r.title === title && r.roomTypeId === roomTypeId);
  if (hit) return hit.id;
  const j = await api("POST", "/rate_plans", {
    rate_plan: {
      title, property_id: propertyId, room_type_id: roomTypeId,
      currency: "EUR", sell_mode: "per_room", rate_mode: "manual",
      options: [{ occupancy: 2, is_primary: true, rate: 0 }],
    },
  });
  return j.data.id as string;
}

async function main() {
  if (!apiKey || !propertyId) {
    console.log("Set CHANNEX_API_KEY + CHANNEX_PROPERTY_ID (see .env.local) and re-run.");
    return;
  }

  let roomTypes = await listRoomTypes();
  let ratePlans = await listRatePlans();

  // Reuse the original "Deluxe Double" as the Double Room; rename it + its rate plan for clean
  // certification screenshots. (PATCH is idempotent — safe on a re-run.)
  const original = roomTypes.find((r: any) => r.title === "Deluxe Double");
  if (original) {
    await api("PUT", `/room_types/${original.id}`, { room_type: { title: "Double Room" } });
    const origRate = ratePlans.find((r: any) => r.roomTypeId === original.id && r.title === "Standard Rate");
    if (origRate) await api("PUT", `/rate_plans/${origRate.id}`, { rate_plan: { title: "Best Available Rate" } });
    roomTypes = await listRoomTypes();
    ratePlans = await listRatePlans();
  }

  const doubleId = await ensureRoomType("Double Room", 6, roomTypes);
  const twinId = await ensureRoomType("Twin Room", 8, roomTypes);

  const doublePlans = await listRatePlansForRoom(doubleId);
  const doubleBar = await ensureRatePlan("Best Available Rate", doubleId, doublePlans);
  const doubleBreakfast = await ensureRatePlan("Breakfast", doubleId, doublePlans);
  const twinPlans = await listRatePlansForRoom(twinId);
  const twinBar = await ensureRatePlan("Best Available Rate", twinId, twinPlans);
  const twinBreakfast = await ensureRatePlan("Breakfast", twinId, twinPlans);

  console.log("\n✓ Certification property ready — 2 room types, 4 rate plans.\n");
  console.log("Update packages/connectivity/.env.local:\n");
  console.log(`CHANNEX_PROPERTY_ID="${propertyId}"`);
  console.log(`CHANNEX_DOUBLE_ROOM_ID="${doubleId}"`);
  console.log(`CHANNEX_TWIN_ROOM_ID="${twinId}"`);
  console.log(`CHANNEX_DOUBLE_BAR_ID="${doubleBar}"`);
  console.log(`CHANNEX_DOUBLE_BREAKFAST_ID="${doubleBreakfast}"`);
  console.log(`CHANNEX_TWIN_BAR_ID="${twinBar}"`);
  console.log(`CHANNEX_TWIN_BREAKFAST_ID="${twinBreakfast}"`);
  console.log(`\n# legacy single-room vars (kept for channex:smoke/book):`);
  console.log(`CHANNEX_ROOM_TYPE_ID="${doubleId}"`);
  console.log(`CHANNEX_RATE_PLAN_ID="${doubleBar}"`);
}

main().catch((err) => {
  console.error("Cert setup failed:", err.message ?? err);
  process.exit(1);
});
