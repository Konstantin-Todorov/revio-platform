/**
 * Create a TEST booking in the Channex SANDBOX and pull it back through our adapter — proving the
 * full inbound loop (an OTA books → Channex → RevioLink pulls it), the last piece of the ARI loop.
 *
 *   pnpm --filter @revio/connectivity channex:book
 *
 * Requires the "Booking CRS" app installed on the sandbox property (Applications tab) — it enables
 * the offline Booking-creation API. Reads the same env as the smoke test (.env.local). The booking is
 * an `ota_name: "Offline"` reservation for a 2-night stay, mapped to our room type + rate plan; then
 * `adapter.pullReservations` fetches it and normalizes it into our RawReservation shape.
 */

import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY;
const propertyId = env.CHANNEX_PROPERTY_ID;
const roomTypeId = env.CHANNEX_ROOM_TYPE_ID;
const ratePlanId = env.CHANNEX_RATE_PLAN_ID;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

function ymd(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  if (!apiKey || !propertyId || !roomTypeId || !ratePlanId) {
    console.log("Missing env — set CHANNEX_API_KEY / PROPERTY_ID / ROOM_TYPE_ID / RATE_PLAN_ID (see .env.local).");
    return;
  }

  const arrival = ymd(3);
  const departure = ymd(5); // 2 nights
  const nightly = "120.00";
  const code = `REVIO-TEST-${Date.now().toString().slice(-6)}`;

  const booking = {
    booking: {
      property_id: propertyId,
      ota_name: "Offline",
      ota_reservation_code: code,
      arrival_date: arrival,
      departure_date: departure,
      currency: "EUR",
      payment_collect: "property",
      customer: { name: "Ivan", surname: "Petrov", mail: "ivan.petrov@example.com", phone: "+359881112233", country: "BG" },
      rooms: [
        {
          room_type_id: roomTypeId,
          rate_plan_id: ratePlanId,
          days: { [arrival]: nightly, [ymd(4)]: nightly },
          occupancy: { adults: 2, children: 0, infants: 0 },
          guests: [{ name: "Ivan", surname: "Petrov" }],
        },
      ],
    },
  };

  console.log(`Creating test booking ${code}  (${arrival} → ${departure}, 2 nights @ €${nightly}) …`);
  const res = await fetch(`${baseUrl}/bookings`, {
    method: "POST",
    headers: { "user-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(booking),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`  ✗ create failed → ${res.status}: ${JSON.stringify(json)}`);
    process.exit(1);
  }
  console.log(`  ✓ created  channex id=${json?.data?.id ?? "?"}  code=${code}\n`);

  // Pull it back through OUR adapter — the exact path RevioLink uses in production.
  const adapter = new ChannexChannelAdapter({ apiKey, propertyId, baseUrl, channelCode: "channex-sandbox" });
  console.log("Pulling bookings back through the Revio adapter …");
  const bookings = await adapter.pullReservations(ymd(-1) + "T00:00:00");
  console.log(`  ${bookings.length} booking(s) returned by the adapter:`);
  for (const b of bookings.slice(0, 10)) {
    const line = b.lines[0];
    console.log(
      `  • ${b.externalId}  ${b.status}  ${b.guestName}  ${(b.totalMinor / 100).toFixed(2)} ${b.currency}` +
        (line ? `  ${line.checkIn}→${line.checkOut} ×${line.quantity}` : ""),
    );
  }
  const mine = bookings.find((b) => b.guestName.includes("Petrov"));
  console.log(mine ? `\n✓ Round trip complete — our adapter pulled the booking we just created (${mine.externalId}).` : "\n(Booking created; give Channex a few seconds and re-run if it's not listed yet.)");

  // Acknowledge every unacked revision so Channex stops re-sending them (certification requirement).
  const raw = await fetch(`${baseUrl}/bookings?filter[property_id]=${propertyId}`, {
    headers: { "user-api-key": apiKey, Accept: "application/json" },
  }).then((r) => r.json()).catch(() => null);
  const revisions: string[] = (raw?.data ?? [])
    .filter((b: any) => b?.attributes?.acknowledge_status !== "acknowledged" && b?.attributes?.revision_id)
    .map((b: any) => b.attributes.revision_id);
  if (revisions.length > 0) {
    console.log(`\nAcknowledging ${revisions.length} booking revision(s) …`);
    let acked = 0;
    for (const id of revisions) {
      const r = await adapter.acknowledgeBooking(id);
      if (r.ok) acked++;
      else console.log(`  ✗ ${id}: ${r.error}`);
    }
    console.log(`  ✓ acknowledged ${acked}/${revisions.length} — Channex will not re-send them.`);
  }
}

main().catch((err) => {
  console.error("Test booking failed:", err);
  process.exit(1);
});
