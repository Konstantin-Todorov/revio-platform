import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "./client.js";
import { takeAllowance } from "./public-allowance.js";

/**
 * Runs against a real database because the whole point is the single-statement upsert: a mock would
 * agree with any SQL. Skips when no database is reachable, like the other `.db.test.ts` files.
 */

let reachable = false;
const key = `test-${randomUUID()}`;
beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; reachable = true; } catch { reachable = false; }
});
afterAll(async () => {
  if (reachable) {
    await prisma.$transaction([
      prisma.$executeRaw`SELECT set_config('app.bypass', 'on', true)`,
      prisma.$executeRaw`DELETE FROM "LoginAttempt" WHERE "identifier" LIKE ${`${key}%`}`,
    ]);
  }
  await prisma.$disconnect();
});

describe("takeAllowance", () => {
  const rule = { limit: 3, windowMs: 60_000 };

  it("allows up to the limit, then refuses, inside one window", async () => {
    if (!reachable) return;
    const t0 = new Date("2026-10-11T10:00:00Z");
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await takeAllowance("card-hold", `${key}-a`, rule, t0)).ok);
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("opens a fresh window once the old one has passed", async () => {
    if (!reachable) return;
    const t0 = new Date("2026-10-11T10:00:00Z");
    for (let i = 0; i < 4; i++) await takeAllowance("card-hold", `${key}-b`, rule, t0);
    const later = new Date(t0.getTime() + rule.windowMs + 1);
    expect((await takeAllowance("card-hold", `${key}-b`, rule, later)).ok).toBe(true);
  });

  it("keeps scopes apart", async () => {
    if (!reachable) return;
    const t0 = new Date("2026-10-11T10:00:00Z");
    for (let i = 0; i < 4; i++) await takeAllowance("card-ip", `${key}-c`, rule, t0);
    expect((await takeAllowance("mail-ip", `${key}-c`, rule, t0)).ok).toBe(true);
  });

  it("lets exactly `limit` through when requests race", async () => {
    if (!reachable) return;
    const t0 = new Date("2026-10-11T10:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => takeAllowance("hold-property", `${key}-d`, rule, t0)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(rule.limit);
  });

  it("says when the window resets", async () => {
    if (!reachable) return;
    const t0 = new Date("2026-10-11T10:00:00Z");
    const r = await takeAllowance("card-ip", `${key}-e`, rule, new Date(t0.getTime() + 10_000));
    expect(r.retryAfterMs).toBe(rule.windowMs);
  });
});
