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
    /*
     * The real `sendEmail` resolves an `EmailResult`, never `undefined`.
     *
     * The mock used to resolve nothing, which was invisible while the sweep ignored the return
     * value — and became a crash the moment it started reporting sent-versus-failed honestly. A mock
     * that does not honour its function's contract is a test asserting against a thing that does
     * not exist.
     */
    mail.send.mockReset().mockResolvedValue({ ok: true, mode: "mock" });
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

/*
 * ---------------------------------------------------------------------------------------------
 * What the sweep SAYS it did (2026-09-11).
 *
 * `reminded` used to be incremented whether or not anything was sent — including when the account
 * had no owner with an email address at all. A hotel in that state loses access on the day with no
 * warning whatsoever, and the one place that could have said so was reporting that it had told them.
 * ---------------------------------------------------------------------------------------------
 */
describe.skipIf(!enabled)("the sweep reports what actually happened", () => {
  const db = forSystem();
  const created: string[] = [];
  const now = new Date("2026-09-09T12:00:00.000Z");
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

  beforeEach(() => {
    mail.send.mockReset().mockResolvedValue({ ok: true, mode: "mock" });
  });

  afterEach(async () => {
    if (created.length) await db.tenant.deleteMany({ where: { id: { in: created.splice(0) } } });
  });

  /** A tenant on a trial ending in `days`, optionally with nobody to write to. */
  async function trialTenant(days: number, opts: { owner: boolean }) {
    const id = crypto.randomUUID();
    const tenant = await db.tenant.create({
      data: {
        id,
        name: `Reporting ${id.slice(0, 8)}`,
        slug: `trial-report-${id}`,
        isDemo: true,
        hasPms: true,
        ...(opts.owner
          ? {
              users: {
                create: {
                  name: "Owner", email: `${id}@trial-report.invalid`,
                  role: "owner", active: true, passwordHash: "x",
                },
              },
            }
          : {}),
      },
    });
    created.push(tenant.id);
    await db.productTrial.create({
      data: { tenantId: tenant.id, product: "pms", startedAt: now, endsAt: inDays(days) },
    });
    return tenant;
  }

  it("does NOT call a warning sent when there is nobody to send it to", async () => {
    const tenant = await trialTenant(1, { owner: false });
    const r = await sweepTrials(now);

    expect(mail.send).not.toHaveBeenCalled();
    expect(r.reminded).toBe(0);
    expect(r.unreachable).toBeGreaterThanOrEqual(1);
    expect(r.details.join("\n")).toMatch(/NOBODY TO WARN/);

    // And the threshold is NOT consumed, so the repair still works.
    const trial = await db.productTrial.findFirstOrThrow({ where: { tenantId: tenant.id } });
    expect(trial.remindedAt1).toBeNull();
  });

  /*
   * THE reason the threshold is left alone in that case. A missing owner email is a five-minute
   * repair; consuming the threshold would turn it into a permanent loss of the warning.
   */
  it("sends the warning on the next sweep once somebody can receive it", async () => {
    const tenant = await trialTenant(1, { owner: false });
    await sweepTrials(now);
    expect(mail.send).not.toHaveBeenCalled();

    await db.user.create({
      data: { tenantId: tenant.id, email: `added-later-${tenant.id}@trial-report.invalid`, name: "Owner", role: "owner", active: true, passwordHash: "x" },
    });

    const r = await sweepTrials(now);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(r.reminded).toBe(1);
    expect(r.unreachable).toBe(0);
  });

  it("reports a refused send as FAILED, not as sent — but still consumes the threshold", async () => {
    /*
     * The threshold is consumed on a provider failure on purpose: the alternative is retrying every
     * five minutes for the rest of the trial and, if the provider recovers, a burst of identical
     * warnings. One missed warning is recoverable; twenty is not. What changed is that it is no
     * longer COUNTED as sent.
     */
    const tenant = await trialTenant(1, { owner: true });
    mail.send.mockResolvedValue({ ok: false, mode: "resend", error: "Resend 422" });

    const r = await sweepTrials(now);
    expect(r.reminded).toBe(0);
    expect(r.failed).toBe(1);
    expect(r.details.join("\n")).toMatch(/FAILED to send/);

    const trial = await db.productTrial.findFirstOrThrow({ where: { tenantId: tenant.id } });
    expect(trial.remindedAt1).not.toBeNull();
  });

  it("expires a trial nobody could be warned about, and says nobody was told", async () => {
    // The entitlement must still be revoked — the clock ran out either way. What must not happen is
    // the operator reading a clean expiry line for a customer who was cut off in silence.
    const tenant = await trialTenant(-1, { owner: false });
    const r = await sweepTrials(now);

    expect(r.expired).toBe(1);
    expect(r.details.join("\n")).toMatch(/NOBODY WAS TOLD/);
    const after = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(after.hasPms).toBe(false);
  });
});
