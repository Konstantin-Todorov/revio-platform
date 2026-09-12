import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { activatePendingSignup, createPublicSignup } from "./public-signup.js";

/**
 * The signup chain, against a REAL database.
 *
 * ## Why this file exists
 *
 * Everything else about signup is tested as pure functions, and pure functions cannot answer the
 * question that actually matters: *does a hotel that already had a trial get another one?* That
 * lives in rows — a tenant, three entitlement booleans, three `ProductTrial` records and a token —
 * written across two moments separated by an email. It was shipped once with no test at all, and
 * this file is the repayment.
 *
 * ## Running it
 *
 *     createdb revio_signup_test
 *     DATABASE_URL=postgresql://localhost/revio_signup_test pnpm --filter @revio/db db:deploy
 *     DATABASE_URL=postgresql://localhost/revio_signup_test pnpm --filter @revio/db test
 *
 * With no database it SKIPS rather than fails, and says so — a developer without Postgres running
 * must not be blocked, and CI supplies one (see `.github/workflows/ci.yml`).
 */

/**
 * ⚠️ THIS FILE DELETES EVERY TENANT IN THE DATABASE IT IS POINTED AT.
 *
 * `pnpm test` is run with whatever `DATABASE_URL` happens to be exported, and on a developer's
 * machine that is usually their working database. Accepting it unconditionally would mean one
 * absent-minded `pnpm test` destroys a day's seeded data — and on a machine with production
 * credentials exported, something far worse than a day.
 *
 * So the URL is only accepted if the database it names LOOKS like a throwaway: `*_test`, `*_ci`, or
 * exactly `revio_ci`. Anything else is refused loudly rather than skipped quietly, because a
 * developer who meant to run these deserves to know why they did not.
 */
const RAW_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

function isDisposableDatabase(u: string | undefined): { ok: boolean; name?: string; why?: string } {
  if (!u) return { ok: false, why: "no DATABASE_URL or TEST_DATABASE_URL" };
  let name: string;
  try {
    name = new URL(u).pathname.replace(/^\//, "");
  } catch {
    return { ok: false, why: "unparseable database URL" };
  }
  if (!name) return { ok: false, why: "URL names no database" };
  if (/(_test|_ci)$/.test(name) || name === "revio_ci") return { ok: true, name };
  return {
    ok: false,
    name,
    why: `refusing to wipe "${name}" — these tests delete every tenant, so they only run against a database whose name ends in _test or _ci`,
  };
}

const gate = isDisposableDatabase(RAW_URL);
const url = gate.ok ? RAW_URL : undefined;
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

let reachable = false;
beforeAll(async () => {
  if (!prisma) return;
  try {
    await prisma.$queryRaw`SELECT 1`;
    reachable = true;
  } catch {
    reachable = false;
  }
});
afterAll(async () => {
  await prisma?.$disconnect();
});

if (!gate.ok && RAW_URL) {
  // Loud, because a silent skip here is indistinguishable from a pass.
  console.warn(`\n⚠️  public-signup integration tests SKIPPED: ${gate.why}\n`);
}

const describeDb = gate.ok ? describe : describe.skip;

describeDb("public signup, end to end", () => {
  beforeEach(async () => {
    if (!reachable) return;
    /*
     * ⚠️ ONE truncate, CASCADE — not a hand-written list of deletes in dependency order.
     *
     * The list version passed locally against an empty database and failed in CI against a seeded
     * one: demo reservation lines hold foreign keys into the rate plans it was clearing, and no
     * amount of reordering fixes that without naming every table that will ever reference a tenant.
     * That list rots the first time somebody adds a model, and it rots into a red build in CI
     * rather than into a visible mistake here.
     *
     * `TRUNCATE ... CASCADE` from `Tenant` is order-independent by construction: the database
     * already knows what points at a tenant, which is exactly the knowledge the list was trying to
     * duplicate. `AuthToken` is named separately because a token hangs off a user by id rather than
     * by a foreign key that cascades.
     */
    await prisma!.$executeRawUnsafe(`SELECT set_config('app.bypass', 'on', true)`);
    await prisma!.$executeRawUnsafe(`TRUNCATE TABLE "Tenant", "AuthToken" RESTART IDENTITY CASCADE`);
  });

  const NEW = {
    hotelName: "Hotel Cabacum Beach",
    ownerName: "Maria Ivanova",
    email: "maria@cabacum.bg",
    intent: "cm" as const,
  };

  async function tenantOf(email: string) {
    const u = await prisma!.user.findFirst({ where: { email }, include: { tenant: true } });
    return u?.tenant ?? null;
  }

  it("is pointed at a throwaway database, never a real one", () => {
    // The guard above, asserted: if this file ever runs, the database it is about to empty is one
    // whose name says it is disposable.
    expect(gate.ok).toBe(true);
    expect(gate.name).toMatch(/(_test|_ci)$|^revio_ci$/);
  });

  it("⚠️ creates an INERT account: no entitlement, no trial, no clock running", async () => {
    if (!reachable) return;
    const out = await createPublicSignup(NEW);
    expect(out.ok && out.kind).toBe("created");

    const tenant = await tenantOf(NEW.email);
    expect(tenant).not.toBeNull();
    // The whole safety argument: every app refuses a session whose tenant is not "active".
    expect(tenant!.status).toBe("pending_signup");
    expect(tenant!.hasChannelManager).toBe(false);
    expect(tenant!.hasReservation).toBe(false);
    expect(tenant!.hasPms).toBe(false);
    expect(await prisma!.productTrial.count({ where: { tenantId: tenant!.id } })).toBe(0);

    // And it is genuinely usable once confirmed — a property and a manual parent rate plan exist.
    expect(await prisma!.property.count({ where: { tenantId: tenant!.id } })).toBe(1);
    expect(await prisma!.ratePlan.count({ where: { tenantId: tenant!.id, priceLogic: "manual" } })).toBe(1);
    // Nobody at Revio ever knows a customer's password; there is not one yet.
    const owner = await prisma!.user.findFirst({ where: { email: NEW.email } });
    expect(owner!.passwordHash).toBeNull();
    expect(owner!.role).toBe("owner");
  });

  it("confirming switches on ALL THREE products and starts three clocks", async () => {
    if (!reachable) return;
    await createPublicSignup(NEW);
    const tenant = (await tenantOf(NEW.email))!;

    expect(await activatePendingSignup(tenant.id)).toBe(true);

    const after = await prisma!.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(after.status).toBe("active");
    expect([after.hasChannelManager, after.hasReservation, after.hasPms]).toEqual([true, true, true]);

    const trials = await prisma!.productTrial.findMany({ where: { tenantId: tenant.id } });
    expect(trials.map((t) => t.product).sort()).toEqual(["cm", "crs", "pms"]);
    for (const t of trials) {
      expect(t.endedAt).toBeNull();
      expect(t.endsAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("⚠️ activation is idempotent — a replayed link cannot double the trials", async () => {
    if (!reachable) return;
    await createPublicSignup(NEW);
    const tenant = (await tenantOf(NEW.email))!;

    expect(await activatePendingSignup(tenant.id)).toBe(true);
    // Second call: the tenant is no longer pending, so nothing happens at all.
    expect(await activatePendingSignup(tenant.id)).toBe(false);
    expect(await prisma!.productTrial.count({ where: { tenantId: tenant.id } })).toBe(3);
  });

  it("⚠️ a second attempt BEFORE confirming resends — it does not make a second hotel", async () => {
    if (!reachable) return;
    // The spam-folder case. Creating another tenant here is the gap: confirm both and the same
    // hotel holds six trials.
    const first = await createPublicSignup(NEW);
    const second = await createPublicSignup(NEW);

    expect(first.ok && first.kind).toBe("created");
    expect(second.ok && second.kind).toBe("resent");
    expect(await prisma!.tenant.count()).toBe(1);
    expect(await prisma!.user.count()).toBe(1);
  });

  it("⚠️ THE FOUNDER'S GAP: a hotel that already trialled gets no second trial", async () => {
    if (!reachable) return;
    // Trialled everything, never bought, comes back months later through the public form.
    await createPublicSignup(NEW);
    const tenant = (await tenantOf(NEW.email))!;
    await activatePendingSignup(tenant.id);
    await prisma!.user.update({ where: { id: (await prisma!.user.findFirstOrThrow({ where: { email: NEW.email } })).id }, data: { passwordHash: "x" } });
    // The trials ran out and the products were switched back off, as they would be after 30 days.
    await prisma!.productTrial.updateMany({ where: { tenantId: tenant.id }, data: { endedAt: new Date(), outcome: "expired" } });
    await prisma!.tenant.update({ where: { id: tenant.id }, data: { hasReservation: false, hasPms: false } });

    const again = await createPublicSignup({ ...NEW, hotelName: "Hotel Cabacum Beach 2" });

    expect(again.ok && again.kind).toBe("already-a-customer");
    expect(await prisma!.tenant.count()).toBe(1);
    expect(await prisma!.productTrial.count()).toBe(3); // the original three, still expired
  });

  it("⚠️ a plus-addressed alias is the SAME mailbox — the commonest way a trial is taken twice", async () => {
    if (!reachable) return;
    await createPublicSignup({ ...NEW, email: "maria@gmail.com" });
    const t = (await tenantOf("maria@gmail.com"))!;
    await activatePendingSignup(t.id);
    await prisma!.user.updateMany({ where: { email: "maria@gmail.com" }, data: { passwordHash: "x" } });

    for (const alias of ["maria+trial2@gmail.com", "maria+again@gmail.com", "m.a.r.i.a@gmail.com"]) {
      const out = await createPublicSignup({ ...NEW, email: alias });
      expect(out.ok && out.kind, alias).toBe("already-a-customer");
    }
    expect(await prisma!.tenant.count()).toBe(1);
    expect(await prisma!.productTrial.count()).toBe(3);
  });

  it("keeps two genuinely different people at one hotel apart", async () => {
    if (!reachable) return;
    // maria.ivanova@ and mariaivanova@ are two staff at a normal mail host. Merging them would hand
    // one hotelier the other's account — the opposite failure, and a worse one.
    await createPublicSignup({ ...NEW, email: "maria.ivanova@cabacum.bg" });
    const out = await createPublicSignup({ ...NEW, email: "mariaivanova@cabacum.bg", hotelName: "Another Hotel" });
    expect(out.ok && out.kind).toBe("created");
    expect(await prisma!.tenant.count()).toBe(2);
  });

  it("refuses a throwaway mailbox before anything is written", async () => {
    if (!reachable) return;
    const out = await createPublicSignup({ ...NEW, email: "a@mailinator.com" });
    expect(out.ok).toBe(false);
    expect(await prisma!.tenant.count()).toBe(0);
  });

  it("gives two different hotels with the same name different slugs", async () => {
    if (!reachable) return;
    await createPublicSignup({ ...NEW, email: "a@one.bg" });
    await createPublicSignup({ ...NEW, email: "b@two.bg" });
    const slugs = (await prisma!.tenant.findMany({ select: { slug: true } })).map((t) => t.slug);
    expect(new Set(slugs).size).toBe(2);
  });

  it("records what they said they needed, and it does not limit what they get", async () => {
    if (!reachable) return;
    await createPublicSignup({ ...NEW, intent: "pms" });
    const tenant = (await tenantOf(NEW.email))!;
    expect(tenant.signupIntent).toBe("pms");
    await activatePendingSignup(tenant.id);
    const after = await prisma!.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    // Asked for the PMS; got all three.
    expect([after.hasChannelManager, after.hasReservation, after.hasPms]).toEqual([true, true, true]);
  });
});
