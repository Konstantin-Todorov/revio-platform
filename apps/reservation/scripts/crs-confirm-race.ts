/**
 * Twelve members of staff confirm the SAME hold at the same instant. Exactly one may win.
 *
 *   pnpm --filter @revio/reservation crs-confirm-race
 *
 * ## Why this exists beside `confirm-race`
 *
 * `packages/booking/scripts/confirm-race.ts` proves the guest's booking page converts a hold exactly
 * once. The front desk's path — RevioCRS → Reservations → confirm a hold — is different code, in
 * `apps/reservation/lib/convert-hold.ts`, and nothing raced it. The booking engine documents the
 * very defect this looks for ("one hold, two reservations, one room") and fixed it with a
 * conditional conversion inside a transaction. The staff path converted the hold unconditionally,
 * after the reservation was already written, outside any transaction. A double-clicked button, a
 * retried request or two tabs is enough.
 *
 * It calls the same function the server action calls — not a copy of its sequence — which is why
 * that function takes the database client as a parameter and imports nothing from Next.
 */
import { forSystem } from "@revio/db";
import { convertHoldToReservation } from "../lib/convert-hold";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`crs-confirm-race writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const RACERS = 12;
const MARKER = `crs-race-${Date.now()}`;

async function main() {
  const sys = forSystem();
  const property = await sys.property.findFirst({
    where: { roomTypes: { some: {} }, ratePlans: { some: {} } },
    select: { id: true, tenantId: true, name: true, baseCurrency: true },
    orderBy: { id: "asc" },
  });
  if (!property) {
    console.error("REFUSING TO RUN: no property with room types and rate plans. Seed it first: pnpm db:seed");
    process.exit(2);
  }
  const roomType = await sys.roomType.findFirst({ where: { propertyId: property.id }, orderBy: { id: "asc" } });
  const ratePlan = await sys.ratePlan.findFirst({ where: { propertyId: property.id }, orderBy: { id: "asc" } });
  if (!roomType || !ratePlan) {
    console.error("REFUSING TO RUN: the property has no room type or no rate plan.");
    process.exit(2);
  }

  // Far enough out that no seeded stay or other harness is using it.
  const checkIn = new Date("2029-03-05T00:00:00Z");
  const checkOut = new Date("2029-03-07T00:00:00Z");
  const hold = await sys.hold.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id, roomTypeId: roomType.id,
      quantity: 1, checkIn, checkOut, status: "active", expiresAt: new Date(Date.now() + 10 * 60_000),
      source: "staff",
    },
  });

  console.log(`\nProperty:  ${property.name}\nRoom type: ${roomType.name}\nRate plan: ${ratePlan.name}`);
  console.log(`Hold:      ${hold.id} · ${RACERS} concurrent staff confirms\n`);

  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "  ok  " : " FAIL "} ${name} — ${detail}`);
  };

  try {
    const results = await Promise.allSettled(
      Array.from({ length: RACERS }, (_, i) =>
        convertHoldToReservation(
          property,
          { id: hold.id, roomTypeId: hold.roomTypeId, quantity: hold.quantity, checkIn, checkOut },
          {
            firstName: `Racer${i}`, lastName: MARKER, email: null, phone: null, company: null,
            specialRequests: null, notes: null, ratePlanId: ratePlan.id, bookingSourceId: null,
            paymentGuarantee: "none", priceMinor: 12_000, guestsCount: 2, createdById: null,
          },
        ),
      ),
    );

    const won = results.filter((r) => r.status === "fulfilled").length;
    const reservations = await sys.reservation.count({ where: { propertyId: property.id, guestName: { endsWith: MARKER } } });
    const after = await sys.hold.findUnique({ where: { id: hold.id }, select: { status: true, reservationId: true } });

    record("exactly one confirm won", won === 1, `${won} of ${RACERS}`);
    record("exactly one reservation exists for the hold", reservations === 1, `found ${reservations}`);
    record(
      "every loser was refused rather than half-written",
      results.filter((r) => r.status === "rejected").length === RACERS - won,
      `${RACERS - won} refused`,
    );
    // The guest is written in the same transaction, so each loser's must have rolled back with it.
    // Twelve racers each with a distinct first name: one guest row means eleven were undone.
    const guests = await sys.guest.count({ where: { propertyId: property.id, lastName: MARKER } });
    record("a refused confirm leaves no guest behind — its whole transaction rolled back", guests === 1, `found ${guests}`);
    record(
      "the hold is converted and points at a reservation that exists",
      after?.status === "converted" && !!after.reservationId,
      `${after?.status ?? "missing"} → ${after?.reservationId ?? "nothing"}`,
    );
  } finally {
    await sys.hold.deleteMany({ where: { id: hold.id } });
    const res = await sys.reservation.findMany({ where: { propertyId: property.id, guestName: { endsWith: MARKER } }, select: { id: true } });
    if (res.length > 0) await sys.reservation.deleteMany({ where: { id: { in: res.map((r) => r.id) } } });
    await sys.guest.deleteMany({ where: { propertyId: property.id, lastName: MARKER } });
    console.log("\nCleaned up.");
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
