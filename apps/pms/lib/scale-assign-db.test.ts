import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Automatic room assignment at platform scale — HANDOFF-2026-09-22 §6.
 *
 * The sweep visits every property, every tick, placing the next 60 days of unassigned stays and
 * re-optimising imminent arrivals, inside one request the runner abandons at 120 s. This seeds N
 * hotels of R rooms with a 60-day book at ~60% occupancy, NONE of it assigned (the worst tick: a
 * fresh import), then runs the real sweep twice — the first does all the placing, the second is the
 * steady state every later tick sees.
 *
 * Opt-in, because it writes. Same disposable database as the Close Day scale test:
 *   SCALE_TEST_DATABASE_URL=<url to scale_verify> DATABASE_URL=<same> DIRECT_DATABASE_URL=<same> SCALE_HOTELS=200 SCALE_ROOMS=30 \
 *     pnpm --filter @revio/pms test -- lib/scale-assign-db.test.ts
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

describe.skipIf(!enabled)(`automatic room assignment for ${HOTELS} hotels × ${ROOMS} rooms in one tick`, () => {
  const tenants: string[] = [];

  afterAll(async () => {
    const { forSystem, prisma } = await import("@revio/db");
    const db = forSystem();
    for (const id of tenants) {
      await db.reservation.deleteMany({ where: { tenantId: id } });
      await db.tenant.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }, 900_000);

  it("places a 60-day book and settles inside the runner's 120-second budget", async () => {
    const { forSystem } = await import("@revio/db");
    const { autoAssignAllProperties } = await import("./auto-assign");
    const db = forSystem();
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const day = (n: number) => new Date(today.getTime() + n * 86_400_000);
    let stays = 0;
    const seedStart = Date.now();
    for (let h = 0; h < HOTELS; h++) {
      const tenant = await db.tenant.create({ data: { name: `Assign hotel ${h}`, slug: `assign-${crypto.randomUUID()}`, isDemo: true, hasPms: true } });
      tenants.push(tenant.id);
      const property = await db.property.create({ data: { tenantId: tenant.id, name: `Assign hotel ${h}`, timezone: "Europe/Sofia" } });
      const base = { tenantId: tenant.id, propertyId: property.id };
      await db.propertyDefaults.create({ data: { ...base, autoAssignEnabled: true } });
      const room = await db.roomType.create({ data: { ...base, name: "Double", code: "DBL", totalRooms: ROOMS, maxGuests: 2 } });
      const plan = await db.ratePlan.create({ data: { ...base, name: "Standard", code: "STD", tags: [] } });
      await db.unit.createMany({ data: Array.from({ length: ROOMS }, (_, i) => ({ ...base, roomTypeId: room.id, label: String(100 + i), floor: String(1 + Math.floor(i / 10)), hkStatus: "clean" })) });
      // Per room: 3-night stays with a gap night — ~75% of nights booked, offset per room so arrivals spread.
      const res: { id: string; lineId: string; checkIn: Date; checkOut: Date }[] = [];
      for (let u = 0; u < ROOMS; u++) {
        for (let start = u % 4; start + 3 <= 60; start += 4 + (u % 2)) res.push({ id: crypto.randomUUID(), lineId: crypto.randomUUID(), checkIn: day(start), checkOut: day(start + 3) });
      }
      stays += res.length;
      await db.reservation.createMany({ data: res.map((r) => ({ ...base, id: r.id, guestName: "Scale guest", totalMinor: 27000, status: "confirmed" })) });
      await db.reservationLine.createMany({ data: res.map((r) => ({ id: r.lineId, reservationId: r.id, roomTypeId: room.id, ratePlanId: plan.id, checkIn: r.checkIn, checkOut: r.checkOut, priceMinor: 27000 })) });
    }
    const seedMs = Date.now() - seedStart;

    const t1 = Date.now();
    const first = await autoAssignAllProperties(db);
    const firstMs = Date.now() - t1;
    const t2 = Date.now();
    const second = await autoAssignAllProperties(db);
    const secondMs = Date.now() - t2;
    const placed = await db.roomAssignment.count({ where: { tenantId: { in: tenants }, status: "active" } });
    console.log(`assign scale: ${HOTELS} hotels × ${ROOMS} rooms, ${stays} stays seeded in ${(seedMs / 1000).toFixed(1)} s · ` +
      `first tick ${(firstMs / 1000).toFixed(1)} s (assigned ${first.assigned}, unplaceable ${first.unplaceable}) · ` +
      `steady tick ${(secondMs / 1000).toFixed(1)} s (assigned ${second.assigned}, moved ${second.reoptimised}) · active assignments ${placed}`);
    expect(placed).toBeGreaterThan(stays * 0.95);
    expect(firstMs).toBeLessThan(120_000);
    expect(secondMs).toBeLessThan(120_000);
  }, 3_600_000);
});
