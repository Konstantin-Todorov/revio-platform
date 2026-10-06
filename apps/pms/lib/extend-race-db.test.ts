import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Two receptionists extend two different guests into the LAST free night of a room type, in the
 * same instant. Exactly one may get it — the other must be told the night is sold out, and the room
 * type must never be sold past what it has.
 *
 * The real `extendStay` runs here: only the session, the cache and the channel push are stood in.
 * The room-type claim (`claimHold`), the unit lock and the transaction are the ones production uses.
 * A double press of the same extension is raced too — one wins, the other sees the stay moved.
 *
 * Opt-in, because it writes. A disposable LOOPBACK database named scale_verify (migrated):
 *   SCALE_TEST_DATABASE_URL=<url> DATABASE_URL=<url> DIRECT_DATABASE_URL=<url> \
 *     pnpm --filter @revio/pms test -- lib/extend-race-db.test.ts
 */
const enabled = Boolean(process.env.SCALE_TEST_DATABASE_URL);
if (enabled) {
  const url = new URL(process.env.SCALE_TEST_DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/scale_verify" ||
      process.env.DATABASE_URL !== url.href || process.env.DIRECT_DATABASE_URL !== url.href) {
    throw new Error("The race test writes: all three URLs must name the disposable loopback database scale_verify.");
  }
}

const ctx = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ get prisma() { return ctx.db; } }));
vi.mock("./session", () => ({ getSession: async () => ctx.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`); } }));
vi.mock("@revio/connectivity", () => ({ recordAvailabilityPush: vi.fn(async () => undefined), stayScope: () => ({}) }));

const ROUNDS = 5;
const day = (n: number) => new Date(Date.UTC(2031, 2, 1 + n));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe.skipIf(!enabled)("extending two stays into the last free night at once", () => {
  const tenants: string[] = [];

  afterAll(async () => {
    const { forSystem, prisma } = await import("@revio/db");
    const db = forSystem();
    for (const id of tenants) {
      await db.hold.deleteMany({ where: { tenantId: id } });
      await db.reservation.deleteMany({ where: { tenantId: id } });
      await db.tenant.delete({ where: { id } });
    }
    await prisma.$disconnect();
  }, 120_000);

  async function seed(round: number) {
    const { forSystem, forTenant } = await import("@revio/db");
    const db = forSystem();
    const tenant = await db.tenant.create({ data: { name: `Extend race ${round}`, slug: `extend-race-${crypto.randomUUID()}`, isDemo: true, hasPms: true } });
    tenants.push(tenant.id);
    const property = await db.property.create({ data: { tenantId: tenant.id, name: `Extend race ${round}`, timezone: "Europe/Sofia" } });
    const base = { tenantId: tenant.id, propertyId: property.id };
    await db.propertyDefaults.create({ data: base });
    const room = await db.roomType.create({ data: { ...base, name: "Double", code: "DBL", totalRooms: 3, maxGuests: 2 } });
    const plan = await db.ratePlan.create({ data: { ...base, name: "Standard", code: "STD", tags: [], priceLogic: "manual" } });
    await db.ratePrice.createMany({ data: [0, 1, 2, 3].map((n) => ({ ...base, roomTypeId: room.id, ratePlanId: plan.id, date: day(n), priceMinor: 10_000 })) });
    const units = await Promise.all(["101", "102", "103"].map((label) => db.unit.create({ data: { ...base, roomTypeId: room.id, label, hkStatus: "clean" } })));
    const user = await db.user.create({ data: { tenantId: tenant.id, email: `race-${crypto.randomUUID()}@example.test`, name: "Race", role: "owner", passwordHash: "x" } });

    // Two guests in 101 and 102 leaving on day 2; a third guest takes 103 FROM day 2.
    const stay = async (unitId: string, from: number, to: number, name: string) => {
      const r = await db.reservation.create({
        data: {
          ...base, guestName: name, status: "confirmed", totalMinor: 10_000 * (to - from), currency: "EUR",
          lines: { create: [{ roomTypeId: room.id, ratePlanId: plan.id, quantity: 1, checkIn: day(from), checkOut: day(to), priceMinor: 10_000 * (to - from), guestsCount: 2 }] },
        },
        include: { lines: true },
      });
      return db.roomAssignment.create({
        data: { ...base, reservationId: r.id, reservationLineId: r.lines[0]!.id, unitId, checkIn: day(from), checkOut: day(to), status: "active" },
      });
    };
    const a = await stay(units[0]!.id, 0, 2, "Guest A");
    const b = await stay(units[1]!.id, 0, 2, "Guest B");
    await stay(units[2]!.id, 2, 4, "Guest C");
    // …and one booking for day 2 with no room yet (a channel booking auto-assignment has not placed).
    // Day 2: three rooms, two sold — one left for A or B.
    await db.reservation.create({
      data: {
        ...base, guestName: "Guest D", status: "confirmed", totalMinor: 10_000, currency: "EUR",
        lines: { create: [{ roomTypeId: room.id, ratePlanId: plan.id, quantity: 1, checkIn: day(2), checkOut: day(3), priceMinor: 10_000 }] },
      },
    });

    ctx.db = forTenant(tenant.id);
    ctx.session = {
      perimeter: "hotel", tenantId: tenant.id, userId: user.id, userName: "Race", role: "owner",
      entitlements: { channelManager: false, reservation: true, pms: true },
      activePropertyId: property.id, tenantName: tenant.name, locale: null,
    };
    return { a, b, roomTypeId: room.id };
  }

  const form = (assignmentId: string) => {
    const fd = new FormData();
    fd.set("assignmentId", assignmentId);
    fd.set("checkOut", ymd(day(2)));
    fd.set("newCheckOut", ymd(day(3)));
    fd.set("totalMinor", "10000");
    return fd;
  };

  it("sells the last night once, never twice", async () => {
    const { forSystem } = await import("@revio/db");
    const { extendStay } = await import("./actions-extend");
    for (let round = 0; round < ROUNDS; round++) {
      const { a, b, roomTypeId } = await seed(round);
      const outcomes = await Promise.all([extendStay(form(a.id)), extendStay(form(b.id))]);
      // Exactly one wins; the other is told the night is sold out.
      expect(outcomes.map((o) => (o.ok ? "ok" : o.code)).sort(), `round ${round}`).toEqual(["ok", "sold_out"]);

      // The waterfall agrees: day 2 holds exactly three rooms sold, never four.
      const sold = await forSystem().reservationLine.aggregate({
        _sum: { quantity: true },
        where: { roomTypeId, reservation: { status: { in: ["confirmed", "modified"] } }, checkIn: { lte: day(2) }, checkOut: { gt: day(2) } },
      });
      expect(sold._sum.quantity).toBe(3); // C + D + the one extension
      const activeHolds = await forSystem().hold.count({ where: { roomTypeId, status: "active" } });
      expect(activeHolds).toBe(0);
    }
  }, 300_000);

  it("takes a double press of one extension once", async () => {
    const { forSystem } = await import("@revio/db");
    const { extendStay } = await import("./actions-extend");
    const { a } = await seed(ROUNDS);
    const outcomes = await Promise.all([extendStay(form(a.id)), extendStay(form(a.id))]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const line = await forSystem().reservationLine.findFirst({ where: { assignments: { some: { id: a.id } } } });
    expect(ymd(line!.checkOut)).toBe(ymd(day(3)));
    expect(line!.priceMinor).toBe(30_000);
  }, 120_000);
});
