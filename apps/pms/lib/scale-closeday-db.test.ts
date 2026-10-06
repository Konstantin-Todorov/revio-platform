import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * The automatic Close Day at platform scale — HANDOFF-2026-09-22 §6.
 *
 * Every Bulgarian hotel shares one time zone, so every one of them falls due for its automatic close
 * in the SAME cron tick. `autoCloseOverdueDays` closes them one after another inside one HTTP request
 * that the runner abandons at 120 s (`scripts/run-jobs.mjs`). This seeds N hotels of R occupied rooms,
 * all overdue, runs the real sweep once, and reports how long it took.
 *
 * Opt-in, because it writes thousands of rows. A disposable LOOPBACK database named scale_verify:
 *   createdb scale_verify && pg_dump revio_dev | psql -q scale_verify   (then grant revio_app)
 *   SCALE_TEST_DATABASE_URL=<url> DATABASE_URL=<url> DIRECT_DATABASE_URL=<url> SCALE_HOTELS=200 SCALE_ROOMS=30 \
 *     pnpm --filter @revio/pms test -- lib/scale-closeday-db.test.ts
 */
const enabled = Boolean(process.env.SCALE_TEST_DATABASE_URL);
if (enabled) {
  const url = new URL(process.env.SCALE_TEST_DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/scale_verify" ||
      process.env.DATABASE_URL !== url.href || process.env.DIRECT_DATABASE_URL !== url.href) {
    throw new Error("The scale test writes: all three URLs must name the disposable loopback database scale_verify.");
  }
}
const HOTELS = Number(process.env.SCALE_HOTELS ?? 50);
const ROOMS = Number(process.env.SCALE_ROOMS ?? 30);

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: new Proxy({}, { get() { throw new Error("session DB proxy used by the sweep"); } }) }));
vi.mock("./data", () => ({ activeProperty: vi.fn() }));
vi.mock("./session", () => ({ getSession: async () => null }));
vi.mock("@revio/connectivity", () => ({ syncRealChannels: vi.fn(async () => undefined), recordAvailabilityPush: vi.fn(async () => undefined), stayScope: () => ({}) }));

describe.skipIf(!enabled)(`automatic Close Day for ${HOTELS} hotels × ${ROOMS} rooms in one tick`, () => {
  const tenants: string[] = [];

  afterAll(async () => {
    const { forSystem, prisma } = await import("@revio/db");
    const db = forSystem();
    for (const id of tenants) {
      await db.reservation.deleteMany({ where: { tenantId: id } });
      await db.tenant.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }, 600_000);

  it("finishes inside the runner's 120-second budget", async () => {
    const { forSystem } = await import("@revio/db");
    const { autoCloseOverdueDays } = await import("./auto-close");
    const db = forSystem();
    const day = (offset: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + offset));
    // Overdue whatever the clock says: the business date is three days back.
    const businessDate = day(-3);
    const seedStart = Date.now();
    for (let h = 0; h < HOTELS; h++) {
      const tenant = await db.tenant.create({ data: { name: `Scale hotel ${h}`, slug: `scale-${crypto.randomUUID()}`, isDemo: true, hasPms: true } });
      tenants.push(tenant.id);
      const property = await db.property.create({ data: { tenantId: tenant.id, name: `Scale hotel ${h}`, timezone: "Europe/Sofia", businessDate } });
      const base = { tenantId: tenant.id, propertyId: property.id };
      await db.propertyDefaults.create({ data: { ...base, autoCloseEnabled: true } });
      const room = await db.roomType.create({ data: { ...base, name: "Double", code: "DBL", totalRooms: ROOMS, maxGuests: 2 } });
      const plan = await db.ratePlan.create({ data: { ...base, name: "Standard", code: "STD", tags: [] } });
      const ids = Array.from({ length: ROOMS }, () => ({ r: crypto.randomUUID(), l: crypto.randomUUID(), u: crypto.randomUUID() }));
      const stay = { checkIn: day(-4), checkOut: day(3) };
      await db.reservation.createMany({ data: ids.map((x) => ({ ...base, id: x.r, guestName: "Scale guest", totalMinor: 7 * 9000, status: "confirmed" })) });
      await db.reservationLine.createMany({ data: ids.map((x) => ({ id: x.l, reservationId: x.r, roomTypeId: room.id, ratePlanId: plan.id, ...stay, priceMinor: 7 * 9000 })) });
      await db.unit.createMany({ data: ids.map((x, i) => ({ ...base, id: x.u, roomTypeId: room.id, label: String(100 + i) })) });
      await db.roomAssignment.createMany({ data: ids.map((x) => ({ ...base, reservationId: x.r, reservationLineId: x.l, unitId: x.u, ...stay, checkedInAt: stay.checkIn })) });
      await db.stayExtra.createMany({ data: ids.map((x) => ({ ...base, reservationId: x.r, name: "Breakfast", priceMinor: 1200, basis: "per_night" })) });
    }
    const seedMs = Date.now() - seedStart;

    const t0 = Date.now();
    const result = await autoCloseOverdueDays(db);
    const sweepMs = Date.now() - t0;
    const ours = await db.property.count({ where: { tenantId: { in: tenants }, businessDate: day(-2) } });
    console.log(`scale: seeded ${HOTELS} hotels × ${ROOMS} rooms in ${(seedMs / 1000).toFixed(1)} s · sweep ${(sweepMs / 1000).toFixed(1)} s · ` +
      `${(sweepMs / HOTELS).toFixed(0)} ms per hotel · closed ${result.closed} (ours rolled: ${ours}) · skipped ${result.skipped}`);
    expect(ours).toBe(HOTELS);
    expect(sweepMs).toBeLessThan(120_000);
  }, 1_800_000);
});
