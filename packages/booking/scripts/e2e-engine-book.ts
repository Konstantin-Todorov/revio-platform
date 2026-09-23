/**
 * One booking through the guest's booking page, minus the card step — for the cross-source
 * inventory walk. `publicCreateHold` then `publicCreateReservation`, the same two functions the page
 * calls; the guarantee is optional at this layer and a card number never passes through here.
 *
 *   E2E_LAST=Engine1 pnpm --filter @revio/booking exec tsx scripts/e2e-engine-book.ts
 */
import { forSystem, forTenant } from "@revio/db";
import { publicAvailability, publicCreateHold, publicCreateReservation } from "../src/public-engine.js";

{
  const target = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error("e2e-engine-book writes, so it only runs against a local database.");
    process.exit(2);
  }
}

const checkIn = process.env.E2E_IN ?? "2027-03-10";
const checkOut = process.env.E2E_OUT ?? "2027-03-12";
const last = process.env.E2E_LAST ?? "Engine";

const sys = forSystem();
const property = await sys.property.findFirstOrThrow({
  where: { publicSlug: "hotel-sofia" },
  select: { id: true, tenantId: true, name: true, baseCurrency: true, timezone: true },
});
const db = forTenant(property.tenantId);
const { options, error } = await publicAvailability(db, property, { checkIn, checkOut, guests: 2 });
if (error) { console.log(`availability refused: ${error}`); process.exit(3); }
const suite = options?.find((o) => o.name === "Suite");
if (!suite) { console.log("Suite not offered — sold out as far as the guest can see"); process.exit(4); }
console.log(`guest sees Suite with ${suite.remaining} left before booking`);
const plan = suite.plans[0];
if (!plan) { console.log("Suite offered with no plan"); process.exit(5); }

const held = await publicCreateHold(db, property, { checkIn, checkOut, guests: 2, roomTypeId: suite.roomTypeId });
if (!held.hold) { console.log(`hold refused: ${held.error}`); process.exit(6); }
const r = await publicCreateReservation(db, property, {
  checkIn, checkOut, guests: 2, roomTypeId: suite.roomTypeId, ratePlanId: plan.ratePlanId, holdId: held.hold.id,
  guest: { firstName: "E2E", lastName: last, email: `${last.toLowerCase()}@revio.invalid` },
});
console.log(r.reservationId ? `booked ${r.reservationId} · ${r.status} · total ${(r.totalMinor ?? 0) / 100} ${r.currency}` : `refused: ${r.error}`);
process.exit(r.reservationId ? 0 : 7);
