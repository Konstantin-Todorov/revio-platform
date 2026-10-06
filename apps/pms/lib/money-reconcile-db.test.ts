import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The all-in promise, end to end — the first number a guest sees is the number they pay.
 *
 * Every link of the chain had its own test; the chain did not (HANDOFF-2026-09-22 §5). This books
 * real stays through the guest's booking page and follows each one to the bill:
 *
 *   results page → checkout quote → confirmation → stored total (emails, "My booking")
 *     → folio on arrival → every night audit → tax invoice
 *
 * and requires ONE number at every step, across occupancy, children, nights, extras per night and
 * per stay, every rate plan the page sells, and both city-tax modes. One booking (RV-07NR0F) proved
 * the promise could hold; this proves it holds across the shapes a hotel actually sells.
 *
 * Opt-in, because it writes. Point all three URLs at a disposable LOOPBACK copy of the dev database:
 *   createdb money_verify && pg_dump revio_dev | psql -q money_verify
 *   MONEY_TEST_DATABASE_URL=postgresql://localhost:5432/money_verify \
 *   DATABASE_URL=$MONEY_TEST_DATABASE_URL DIRECT_DATABASE_URL=$MONEY_TEST_DATABASE_URL \
 *     pnpm --filter @revio/pms test -- lib/money-reconcile-db.test.ts
 */
const enabled = Boolean(process.env.MONEY_TEST_DATABASE_URL);
if (enabled) {
  const url = new URL(process.env.MONEY_TEST_DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/money_verify" ||
      process.env.DATABASE_URL !== url.href || process.env.DIRECT_DATABASE_URL !== url.href) {
    throw new Error("The money reconciliation writes: all three URLs must name the disposable loopback database money_verify.");
  }
}

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: new Proxy({}, { get() { throw new Error("session DB proxy used by the reconciliation"); } }) }));
vi.mock("./data", () => ({ activeProperty: vi.fn() }));
vi.mock("./session", () => ({ getSession: async () => null }));
// No channel is real in the dev copy; nothing here may reach Channex.
vi.mock("@revio/connectivity", () => ({ syncRealChannels: vi.fn(async () => undefined), recordAvailabilityPush: vi.fn(async () => undefined), stayScope: () => ({}) }));

type Db = ReturnType<typeof import("@revio/db").forTenant>;

describe.skipIf(!enabled)("money reconciles end to end", () => {
  let db: Db;
  let property: { id: string; tenantId: string; name: string; baseCurrency: string; timezone: string };
  let engine: typeof import("@revio/booking");
  let dbm: typeof import("@revio/db");
  let folio: typeof import("./folio");
  let invoice: typeof import("./invoice");
  let extras: { breakfast: string; transfer: string };
  let cityTaxRate = 0;

  beforeAll(async () => {
    dbm = await import("@revio/db");
    engine = await import("@revio/booking");
    folio = await import("./folio");
    invoice = await import("./invoice");
    const sys = dbm.forSystem();
    property = await sys.property.findFirstOrThrow({
      where: { publicSlug: "hotel-sofia" },
      select: { id: true, tenantId: true, name: true, baseCurrency: true, timezone: true },
    });
    db = dbm.forTenant(property.tenantId);
    // Two extras the guest can choose, priced so a rounding slip would show (an odd cent each).
    const mk = (name: string, priceMinor: number, basis: string) => db.posItem.create({
      data: { tenantId: property.tenantId, propertyId: property.id, name, priceMinor, basis, category: "extra", outlet: "restaurant", directSellable: true, active: true },
      select: { id: true },
    });
    extras = { breakfast: (await mk("Reconcile breakfast", 1199, "per_night")).id, transfer: (await mk("Reconcile transfer", 3501, "per_stay")).id };
    const ct = await db.taxFee.findFirst({ where: { propertyId: property.id, active: true, name: { contains: "ity tax", mode: "insensitive" } } });
    cityTaxRate = ct?.amountMinor ?? 0;
  }, 60_000);

  async function setCityTaxMode(mode: "excluded" | "included") {
    await db.propertyDefaults.update({ where: { propertyId: property.id }, data: { cityTaxMode: mode === "included" ? "included" : "payable_on_spot" } });
  }

  const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  type Case = { room: string; adults: number; childAges: number[]; nights: number; extraIds: string[]; cityTax: "excluded" | "included" };

  function cases(): Case[] {
    const out: Case[] = [];
    const rooms: { room: string; max: number }[] = [
      { room: "Deluxe Double Room", max: 2 }, { room: "Family Room", max: 4 }, { room: "Suite", max: 3 }, { room: "Studio Apartment", max: 3 },
    ];
    const extraSets = [[], ["breakfast"], ["transfer"], ["breakfast", "transfer"]];
    let k = 0;
    for (const cityTax of ["excluded", "included"] as const) {
      for (const r of rooms) {
        // Two nights and up: the demo hotel's rates carry a minimum stay, and a refused one-night
        // stay is the restriction working, not money disagreeing.
        for (const nights of [2, 3, 4, 5, 7]) {
          const adults = 1 + (k % r.max);
          const room = r.max - adults;
          const childAges = room >= 2 && k % 3 === 0 ? [1, 9] : room >= 1 && k % 2 === 0 ? [6] : [];
          out.push({ room: r.room, adults, childAges, nights, extraIds: extraSets[k % 4]!, cityTax });
          k++;
        }
      }
    }
    return out;
  }

  it("one number from the results page to the invoice, for every shape of stay", async () => {
    const failures: string[] = [];
    let checked = 0;
    let start = "2026-11-02";
    for (const [i, c] of cases().entries()) {
      await setCityTaxMode(c.cityTax);
      const extraIds = c.extraIds.map((e) => extras[e as keyof typeof extras]);
      // Find a window the page actually sells this room on (adaptive: the dev data has bookings).
      let found: { checkIn: string; checkOut: string; roomTypeId: string; plans: { ratePlanId: string; name: string; totalMinor: number }[] } | null = null;
      for (let shift = 0; shift < 40 && !found; shift++) {
        const checkIn = addDays(start, shift);
        const checkOut = addDays(checkIn, c.nights);
        const av = await engine.publicAvailability(db, property, { checkIn, checkOut, guests: c.adults, childAges: c.childAges });
        const opt = av.options?.find((o) => o.name === c.room);
        if (opt && opt.plans.length) found = { checkIn, checkOut, roomTypeId: opt.roomTypeId, plans: opt.plans };
      }
      if (!found) { failures.push(`case ${i}: ${c.room} never sold for ${c.nights} nights near ${start}`); continue; }
      start = addDays(start, 2);

      for (const plan of found.plans) {
        const label = `case ${i} · ${c.room} · ${plan.name} · ${c.adults}A+${c.childAges.length}C · ${c.nights}n · extras[${c.extraIds.join(",")}] · city tax ${c.cityTax}`;
        const stay = { checkIn: found.checkIn, checkOut: found.checkOut, guests: c.adults, childAges: c.childAges, roomTypeId: found.roomTypeId, ratePlanId: plan.ratePlanId };

        // 1. The results page (no extras yet) and the checkout quote without extras agree.
        const bare = await engine.publicQuoteStay(db, property, stay);
        if (bare?.totalMinor !== plan.totalMinor) { failures.push(`${label}: results ${plan.totalMinor} ≠ checkout ${bare?.totalMinor}`); continue; }
        // 2. The checkout quote with the extras they ticked.
        const quoted = await engine.publicQuoteStay(db, property, { ...stay, extraIds });
        if (!quoted) { failures.push(`${label}: no quote`); continue; }
        // 3. The confirmation.
        const made = await engine.publicCreateReservation(db, property, {
          ...stay, extraIds, guest: { firstName: "Money", lastName: `Case${i}`, email: `money.case${i}@revio.invalid` },
        });
        if (!made.reservationId) { failures.push(`${label}: refused — ${made.error}`); continue; }
        const rid = made.reservationId;
        const total = quoted.totalMinor;
        const say = (step: string, got: number | null | undefined) => { if (got !== total) failures.push(`${label}: quoted ${total} ≠ ${step} ${got}`); };
        say("confirmation", made.totalMinor);
        // 4. What every email and "My booking" state.
        say("stored total", (await engine.storedStayTotal(db, rid))?.totalMinor);

        // 5. The folio on arrival, then each night's audit — check-in on the arrival evening.
        const line = await db.reservationLine.findFirstOrThrow({ where: { reservationId: rid }, select: { id: true, checkIn: true, checkOut: true } });
        const unit = await db.unit.findFirstOrThrow({ where: { propertyId: property.id, roomTypeId: found.roomTypeId }, select: { id: true } });
        const assignment = await db.roomAssignment.create({
          data: { tenantId: property.tenantId, propertyId: property.id, reservationId: rid, reservationLineId: line.id, unitId: unit.id, checkIn: line.checkIn, checkOut: line.checkOut, checkedInAt: new Date() },
          select: { id: true },
        });
        const folioId = await folio.ensureFolio(property.tenantId, property.id, rid);
        for (let n = 0; n < c.nights; n++) {
          const night = addDays(found.checkIn, n);
          await dbm.withTenantTransaction(property.tenantId, (tx) => folio.accrueStayExtras(property.tenantId, property.id, night, tx));
        }
        const lines = await db.folioLine.findMany({ where: { folioId: folioId! }, select: { kind: true, amountMinor: true, voided: true, taxCategory: true, description: true } });
        const charges = lines.filter((l) => !l.voided && l.kind !== "payment" && !l.kind.startsWith("deposit"));
        say("folio", charges.reduce((s, l) => s + l.amountMinor, 0));
        // 6. The tax invoice the hotel issues from that folio.
        say("invoice gross", invoice.computeTaxSummary(lines, { standard: 20, reduced: 9 }).grossMinor);
        // 7. The tourist tax specifically — every night of every guest, children too, because the council
        //    assesses it from ЕСТИ and ЕСТИ registers everyone (ЗМДТ чл. 61р–61с); none when it is in the rate.
        const cityTax = charges.filter((l) => /city\s*tax/i.test(l.description)).reduce((s, l) => s + l.amountMinor, 0);
        const party = c.adults + c.childAges.length;
        const wantCityTax = c.cityTax === "included" ? 0 : cityTaxRate * party * c.nights;
        if (cityTax !== wantCityTax) failures.push(`${label}: tourist tax ${cityTax} ≠ ${party} people × ${c.nights} nights × ${cityTaxRate} = ${wantCityTax}`);

        // Leave the house as it was: this stay is over, so later audits must not accrue it.
        await db.roomAssignment.update({ where: { id: assignment.id }, data: { checkedOutAt: new Date() } });
        // And give the room back, so the next plan in the same window is not refused for the room
        // this one took — a cancelled stay neither occupies a room nor reaches a later audit.
        await db.reservation.update({ where: { id: rid }, data: { departedAt: new Date(), status: "cancelled" } });
        checked++;
      }
    }
    console.log(`money reconciliation: ${checked} bookings followed to the invoice, ${failures.length} disagreements`);
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(30);
  }, 600_000);
});
