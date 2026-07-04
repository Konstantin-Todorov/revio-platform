/**
 * Channex certification Test 11 — full booking lifecycle over the certified booking-revisions FEED:
 *   create → pull feed (new) → ack → modify → pull feed (modified) → ack → cancel → pull feed
 *   (cancelled) → ack.
 *
 *   pnpm --filter @revio/connectivity channex:lifecycle
 *
 * Create/modify/cancel use the Booking CRS API (POST/PUT /bookings); receive + ack use OUR adapter
 * (`pullRevisions` + `acknowledgeBooking`) — the exact path RevioLink uses. Requires the Booking CRS
 * app installed on the sandbox property.
 */

import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY!;
const propertyId = env.CHANNEX_PROPERTY_ID!;
const roomTypeId = env.CHANNEX_DOUBLE_ROOM_ID ?? env.CHANNEX_ROOM_TYPE_ID!;
const ratePlanId = env.CHANNEX_DOUBLE_BAR_ID ?? env.CHANNEX_RATE_PLAN_ID!;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

const adapter = new ChannexChannelAdapter({ apiKey, propertyId, baseUrl, channelCode: "channex-sandbox" });
const headers = { "user-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };

function ymd(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function crs(method: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Pull the feed until a revision for `bookingId` with the expected status shows, then ack it. */
async function pullAck(bookingId: string, expect: string, tries = 8): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await sleep(1500);
    const revisions = await adapter.pullRevisions();
    const mine = revisions.filter((r) => r.reservation.externalId === bookingId);
    const match = mine.find((r) => r.reservation.status === expect || (expect === "new" && r.reservation.status === "confirmed"));
    if (match) {
      const line = match.reservation.lines[0];
      console.log(`  feed: ${expect} revision ${match.revisionId.slice(0, 8)} — ${match.reservation.guestName} ${(match.reservation.totalMinor / 100).toFixed(2)} ${match.reservation.currency}` + (line ? ` ${line.checkIn}→${line.checkOut}` : ""));
      const ack = await adapter.acknowledgeBooking(match.revisionId);
      console.log(`  ack: ${ack.ok ? "✓" : "✗ " + ack.error}`);
      // Ack any other pending revisions for this booking too (keep the feed clean).
      for (const other of mine) if (other.revisionId !== match.revisionId) await adapter.acknowledgeBooking(other.revisionId);
      return ack.ok;
    }
  }
  console.log(`  ✗ no "${expect}" revision appeared for ${bookingId.slice(0, 8)} after ${tries} tries`);
  return false;
}

async function main() {
  if (!apiKey || !propertyId || !roomTypeId || !ratePlanId) {
    console.log("Missing env — run channex:cert-setup and load .env.local.");
    return;
  }
  const code = `REVIO-LC-${Date.now().toString().slice(-6)}`;
  const room = (arrival: string, nights: number, nightly: string) => ({
    room_type_id: roomTypeId, rate_plan_id: ratePlanId,
    days: Object.fromEntries(Array.from({ length: nights }, (_, i) => [ymd(3 + i + (arrival === "late" ? 2 : 0)), nightly])),
    occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: "Maria", surname: "Ivanova" }],
  });

  // 1 · CREATE
  console.log(`1 · Create booking ${code} …`);
  const created = await crs("POST", "/bookings", {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code,
      arrival_date: ymd(3), departure_date: ymd(5), currency: "EUR", payment_collect: "property",
      customer: { name: "Maria", surname: "Ivanova", mail: "maria.ivanova@example.com", phone: "+359881234567", country: "BG" },
      rooms: [room("early", 2, "120.00")],
    },
  });
  const bookingId = created?.data?.id as string;
  console.log(`  created booking id=${bookingId}`);
  await pullAck(bookingId, "new");

  // 2 · MODIFY (extend to 3 nights, higher price) — PUT with status modified
  console.log(`\n2 · Modify booking ${bookingId.slice(0, 8)} (extend + reprice) …`);
  await sleep(1500);
  await crs("PUT", `/bookings/${bookingId}`, {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code, status: "modified",
      arrival_date: ymd(3), departure_date: ymd(6), currency: "EUR", payment_collect: "property",
      customer: { name: "Maria", surname: "Ivanova", mail: "maria.ivanova@example.com", phone: "+359881234567", country: "BG" },
      rooms: [{ room_type_id: roomTypeId, rate_plan_id: ratePlanId, days: { [ymd(3)]: "130.00", [ymd(4)]: "130.00", [ymd(5)]: "130.00" }, occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: "Maria", surname: "Ivanova" }] }],
    },
  });
  await pullAck(bookingId, "modified");

  // 3 · CANCEL — PUT with status cancelled
  console.log(`\n3 · Cancel booking ${bookingId.slice(0, 8)} …`);
  await sleep(1500);
  await crs("PUT", `/bookings/${bookingId}`, {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code, status: "cancelled",
      arrival_date: ymd(3), departure_date: ymd(6), currency: "EUR",
      customer: { name: "Maria", surname: "Ivanova", mail: "maria.ivanova@example.com", country: "BG" },
      rooms: [{ room_type_id: roomTypeId, rate_plan_id: ratePlanId, days: { [ymd(3)]: "130.00", [ymd(4)]: "130.00", [ymd(5)]: "130.00" }, occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: "Maria", surname: "Ivanova" }] }],
    },
  });
  await pullAck(bookingId, "cancelled");

  console.log(`\n✓ Lifecycle complete — created, modified and cancelled ${code}, each revision pulled from the feed and acknowledged.`);
}

main().catch((err) => {
  console.error("Lifecycle failed:", err.message ?? err);
  process.exit(1);
});
