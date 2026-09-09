import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt-in only. This exercises the real sweep against a migrated disposable PostgreSQL database.
// The URL guard makes it impossible to point the test at a shared or production database by typo.
//
// TRIAL_SWEEP_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/trial_sweep_verify_utf8
// DATABASE_URL=<same URL> DIRECT_DATABASE_URL=<same URL>
// pnpm --filter @revio/operator test -- lib/trial-sweep-db.test.ts
const enabled = Boolean(process.env.TRIAL_SWEEP_TEST_DATABASE_URL);
if (enabled) {
  const url = new URL(process.env.TRIAL_SWEEP_TEST_DATABASE_URL!);
  if (
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/trial_sweep_verify_utf8" ||
    process.env.DATABASE_URL !== url.href ||
    process.env.DIRECT_DATABASE_URL !== url.href
  ) {
    throw new Error("Trial sweep DB tests require the explicitly named disposable loopback database in all three URLs.");
  }
}

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@revio/email", () => ({ sendEmail: mail.send }));

import { forSystem, prisma } from "@revio/db";
import { sweepTrials } from "./trial-sweep";

describe.skipIf(!enabled)("trial sweep against PostgreSQL with real RLS and rows", () => {
  const db = forSystem();
  const tenantIds: string[] = [];
  const now = new Date("2026-09-09T12:00:00.000Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

  beforeAll(async () => {
    const [role] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  beforeEach(() => {
    mail.send.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    for (const id of tenantIds.splice(0)) {
      await db.tenant.delete({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function tenant(name: string) {
    const id = crypto.randomUUID();
    tenantIds.push(id);
    return db.tenant.create({
      data: {
        id,
        name,
        slug: `trial-sweep-${id}`,
        isDemo: true,
        hasChannelManager: true,
        hasReservation: true,
        hasPms: true,
        users: {
          create: {
            name: `${name} owner`,
            email: `${id}@trial-sweep.invalid`,
            role: "owner",
          },
        },
      },
    });
  }

  it("sends each reminder once and keeps the 7-day and 1-day reminders independent", async () => {
    const eight = await tenant("Eight days out");
    const seven = await tenant("Seven days out");
    const oneAfterSeven = await tenant("One day after seven-day reminder");
    const oneWithoutSeven = await tenant("One day without seven-day reminder");

    await db.productTrial.createMany({
      data: [
        { tenantId: eight.id, product: "pms", endsAt: inDays(8) },
        { tenantId: seven.id, product: "pms", endsAt: inDays(7) },
        { tenantId: oneAfterSeven.id, product: "pms", endsAt: inDays(1), remindedAt7: inDays(-6) },
        { tenantId: oneWithoutSeven.id, product: "pms", endsAt: inDays(1) },
      ],
    });

    const first = await sweepTrials(now);
    expect(first).toMatchObject({ reminded: 3, expired: 0 });
    expect(mail.send).toHaveBeenCalledTimes(3);

    const rows = await db.productTrial.findMany({ orderBy: { tenantId: "asc" } });
    const byTenant = new Map(rows.map((row) => [row.tenantId, row]));
    expect(byTenant.get(eight.id)).toMatchObject({ remindedAt7: null, remindedAt1: null });
    expect(byTenant.get(seven.id)?.remindedAt7).toEqual(now);
    expect(byTenant.get(oneAfterSeven.id)?.remindedAt1).toEqual(now);
    expect(byTenant.get(oneWithoutSeven.id)?.remindedAt1).toEqual(now);

    mail.send.mockClear();
    expect(await sweepTrials(now)).toMatchObject({ reminded: 0, expired: 0 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("expires only the trial's product on only its tenant, and a second sweep changes nothing", async () => {
    const expiring = await tenant("Expiring PMS");
    const neighbour = await tenant("Unrelated tenant");
    const trial = await db.productTrial.create({
      data: { tenantId: expiring.id, product: "pms", endsAt: inDays(-1) },
    });

    expect(await sweepTrials(now)).toMatchObject({ reminded: 0, expired: 1 });
    expect(await db.productTrial.findUniqueOrThrow({ where: { id: trial.id } })).toMatchObject({
      endedAt: now,
      outcome: "expired",
    });
    expect(await db.tenant.findUniqueOrThrow({ where: { id: expiring.id } })).toMatchObject({
      hasChannelManager: true,
      hasReservation: true,
      hasPms: false,
    });
    expect(await db.tenant.findUniqueOrThrow({ where: { id: neighbour.id } })).toMatchObject({
      hasChannelManager: true,
      hasReservation: true,
      hasPms: true,
    });

    mail.send.mockClear();
    expect(await sweepTrials(now)).toMatchObject({ reminded: 0, expired: 0 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("rolls back the closed trial when entitlement revocation fails, then retries cleanly", async () => {
    const client = await tenant("Rollback expiry");
    const trial = await db.productTrial.create({
      data: { tenantId: client.id, product: "pms", endsAt: inDays(-1) },
    });

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION trial_sweep_reject_pms_revoke() RETURNS trigger AS $$
      BEGIN
        IF OLD."hasPms" = TRUE AND NEW."hasPms" = FALSE THEN
          RAISE EXCEPTION 'injected entitlement failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trial_sweep_reject_pms_revoke
        BEFORE UPDATE ON "Tenant"
        FOR EACH ROW EXECUTE FUNCTION trial_sweep_reject_pms_revoke();
    `);

    try {
      await expect(sweepTrials(now)).rejects.toThrow("injected entitlement failure");
      expect(await db.productTrial.findUniqueOrThrow({ where: { id: trial.id } })).toMatchObject({
        endedAt: null,
        outcome: null,
      });
      expect(await db.tenant.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ hasPms: true });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trial_sweep_reject_pms_revoke ON "Tenant"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS trial_sweep_reject_pms_revoke()`);
    }

    await expect(sweepTrials(now)).resolves.toMatchObject({ reminded: 0, expired: 1 });
    expect(await db.productTrial.findUniqueOrThrow({ where: { id: trial.id } })).toMatchObject({
      endedAt: now,
      outcome: "expired",
    });
    expect(await db.tenant.findUniqueOrThrow({ where: { id: client.id } })).toMatchObject({ hasPms: false });
  });

  it("enforces the SQL-only partial unique index for one running trial per tenant and product", async () => {
    const client = await tenant("Unique trial");
    await db.productTrial.create({ data: { tenantId: client.id, product: "crs", endsAt: inDays(7) } });

    await expect(
      db.productTrial.create({ data: { tenantId: client.id, product: "crs", endsAt: inDays(30) } }),
    ).rejects.toMatchObject({ code: "P2002" });

    await db.productTrial.updateMany({
      where: { tenantId: client.id, product: "crs", endedAt: null },
      data: { endedAt: now, outcome: "cancelled" },
    });
    await expect(
      db.productTrial.create({ data: { tenantId: client.id, product: "crs", endsAt: inDays(30) } }),
    ).resolves.toMatchObject({ tenantId: client.id, product: "crs", endedAt: null });
  });
});
