/**
 * Channex certification Test 11 — booking lifecycle, received and acknowledged by RevioLink itself.
 *
 *   pnpm --filter @revio/connectivity channex:cert-booking
 *
 * The difference from `channex:lifecycle` matters for certification. That script pulls the feed and
 * acknowledges revisions from the script process, which proves the ADAPTER works but leaves nothing
 * in the product — and the cert asks for "screenshots from your system with this Booking". Worse, a
 * revision acknowledged by the script is gone from the feed, so the real app would never see it.
 *
 * Here the script only plays the OTA: it creates, modifies and cancels the booking through the
 * Booking CRS API, then asks the **deployed RevioLink** to run its own scheduled pull. RevioLink
 * fetches `GET /booking_revisions` , imports the reservation and sends the acknowledgement. Every
 * screenshot afterwards is of a booking the product genuinely received.
 *
 * Required env:
 *   CHANNEX_API_KEY, CHANNEX_PROPERTY_ID, CHANNEX_DOUBLE_ROOM_ID, CHANNEX_DOUBLE_BAR_ID  (.env.local)
 *   CM_URL       — deployed channel-manager origin
 *   CRON_SECRET  — the channel-manager's cron secret (Railway)
 */

import { CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY!;
const propertyId = env.CHANNEX_PROPERTY_ID!;
const roomTypeId = env.CHANNEX_DOUBLE_ROOM_ID ?? env.CHANNEX_ROOM_TYPE_ID!;
const ratePlanId = env.CHANNEX_DOUBLE_BAR_ID ?? env.CHANNEX_RATE_PLAN_ID!;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;
const cmUrl = (env.CM_URL ?? "").replace(/\/$/, "");
const cronSecret = env.CRON_SECRET ?? "";

const headers = { "user-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
const ymd = (o: number) => new Date(Date.now() + o * 86_400_000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function crs(method: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Ask the deployed RevioLink to run its scheduled pull — the app receives and acknowledges, not us. */
async function revioLinkPull(): Promise<{ imported: number; updated: number; failed: number }> {
  const res = await fetch(`${cmUrl}/api/jobs/pull`, {
    method: "POST",
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const json = (await res.json().catch(() => null)) as Record<string, number> | null;
  if (!res.ok) throw new Error(`RevioLink pull → ${res.status}: ${JSON.stringify(json)}`);
  return { imported: json?.imported ?? 0, updated: json?.updated ?? 0, failed: json?.failed ?? 0 };
}

/** How many revisions are still unacknowledged for this booking. 0 proves RevioLink acked. */
async function pendingRevisions(bookingId: string): Promise<number> {
  const res = await fetch(`${baseUrl}/booking_revisions/feed?filter[property_id]=${propertyId}`, { headers });
  const json = (await res.json().catch(() => null)) as { data?: { attributes?: Record<string, unknown> }[] } | null;
  return (json?.data ?? []).filter((r) => r.attributes?.booking_id === bookingId).length;
}

const guest = { name: "Maria", surname: "Ivanova", mail: "maria.ivanova@example.com", phone: "+359881234567", country: "BG" };
const nights = (from: number, count: number, price: string) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [ymd(from + i), price]));

/**
 * Wait for Channex to publish the revision, THEN let RevioLink pull it.
 *
 * Pulling on a fixed sleep raced the publish: the app pulled an empty feed, reported "nothing
 * changed", and the revision was only picked up on the next stage's pull — which made a real bug
 * look like a timing quirk. Waiting for the revision to exist removes the ambiguity, so a stage that
 * reports no change means the app genuinely ignored one.
 */
async function stage(label: string, bookingId: string) {
  let appeared = 0;
  for (let i = 0; i < 12 && appeared === 0; i++) {
    await sleep(1500);
    appeared = await pendingRevisions(bookingId);
  }
  if (appeared === 0) throw new Error(`${label}: Channex never published a revision for this booking`);
  console.log(`  Channex published ${appeared} revision(s)`);

  const pull = await revioLinkPull();
  const pending = await pendingRevisions(bookingId);
  console.log(
    `  RevioLink pull → imported ${pull.imported}, updated ${pull.updated}, failed ${pull.failed}` +
      ` · unacknowledged left: ${pending} ${pending === 0 ? "✓" : "✗"}`,
  );
  if (pull.failed > 0) throw new Error(`${label}: RevioLink reported a failed channel pull`);
  if (pending > 0) throw new Error(`${label}: RevioLink did not acknowledge every revision`);
  if (pull.imported + pull.updated === 0) {
    throw new Error(`${label}: RevioLink acknowledged the revision but recorded no change — the modification was dropped`);
  }
}

async function main() {
  for (const [k, v] of Object.entries({ CHANNEX_API_KEY: apiKey, CHANNEX_PROPERTY_ID: propertyId, CM_URL: cmUrl, CRON_SECRET: cronSecret })) {
    if (!v) throw new Error(`Missing env ${k}`);
  }

  const code = `REVIO-CERT-${Date.now().toString().slice(-6)}`;
  console.log(`Channex property ${propertyId}\nRevioLink        ${cmUrl}\nOTA code         ${code}\n`);

  // 1 · CREATE — the OTA sells a room.
  console.log("1 · CREATE  (Booking CRS → Channex)");
  const created = await crs("POST", "/bookings", {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code,
      arrival_date: ymd(14), departure_date: ymd(16), currency: "EUR", payment_collect: "property",
      customer: guest,
      rooms: [{ room_type_id: roomTypeId, rate_plan_id: ratePlanId, days: nights(14, 2, "120.00"), occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: guest.name, surname: guest.surname }] }],
    },
  });
  const bookingId = created?.data?.id as string;
  console.log(`  booking id = ${bookingId}`);
  await stage("create", bookingId);

  // 2 · MODIFY — the guest extends by a night and the rate moves.
  console.log("\n2 · MODIFY  (2 nights @ €120 → 3 nights @ €130)");
  await crs("PUT", `/bookings/${bookingId}`, {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code, status: "modified",
      arrival_date: ymd(14), departure_date: ymd(17), currency: "EUR", payment_collect: "property",
      customer: guest,
      rooms: [{ room_type_id: roomTypeId, rate_plan_id: ratePlanId, days: nights(14, 3, "130.00"), occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: guest.name, surname: guest.surname }] }],
    },
  });
  await stage("modify", bookingId);

  // 3 · CANCEL — the guest cancels; availability must come back.
  console.log("\n3 · CANCEL");
  await crs("PUT", `/bookings/${bookingId}`, {
    booking: {
      property_id: propertyId, ota_name: "Offline", ota_reservation_code: code, status: "cancelled",
      arrival_date: ymd(14), departure_date: ymd(17), currency: "EUR",
      customer: guest,
      rooms: [{ room_type_id: roomTypeId, rate_plan_id: ratePlanId, days: nights(14, 3, "130.00"), occupancy: { adults: 2, children: 0, infants: 0 }, guests: [{ name: guest.name, surname: guest.surname }] }],
    },
  });
  await stage("cancel", bookingId);

  console.log(`\n✓ Lifecycle complete.\n  Booking ID       ${bookingId}\n  OTA code         ${code}\n  Guest            ${guest.name} ${guest.surname}\n  Received + acknowledged by RevioLink at every stage.`);
}

main().catch((err) => {
  console.error("\n✗ Failed:", err.message ?? err);
  process.exit(1);
});
