/**
 * Rate limits for the public, unauthenticated surface that survive a deploy.
 *
 * RevioDirect's first limiter (`@revio/booking`'s `rate-limit.ts`) counts in process memory. That is
 * right for search — cheap to serve, nothing leaves the building — and wrong for the three things a
 * bot can turn into somebody else's cost:
 *
 *   - a **hold** takes a room off sale on every channel for its TTL;
 *   - a **card intent** creates a Customer and an intent on the HOTEL's Stripe account, one per press;
 *   - a **mail** is sent through our domain, whose reputation every hotel's confirmations depend on.
 *
 * In memory, each deploy hands a running script a fresh allowance, and a second replica doubles it.
 * So these count in Postgres, in the `LoginAttempt` table the sign-in gate already uses for the same
 * reason (a per-identifier counter that outlives the process). Rows carry a `pub:` scope so they never
 * meet a sign-in counter, and `pruneLoginAttempts` already sweeps them.
 *
 * One statement, one round trip: the upsert both counts and decides, so two requests racing on the
 * same key cannot both read "4 of 5" and both pass. It runs with the bypass GUC because, like a
 * sign-in, it happens before any tenant context exists — and the row holds nothing tenant-owned.
 *
 * **Fails open** if the database is unreachable, for the same reason the sign-in gate does: the
 * thing being protected needs the same database, so an outage gives an attacker nothing, while
 * failing closed would turn a Postgres blip into "no guest can book".
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./client.js";

export interface AllowanceRule {
  /** Events allowed inside one window. */
  limit: number;
  /** Window length in milliseconds. Fixed, not sliding — the same trade the in-memory limiter makes. */
  windowMs: number;
}

/** What is being counted. Each is its own namespace so one never spends another's allowance. */
export type AllowanceScope =
  | "hold-ip"
  | "hold-property"
  | "card-hold"
  | "card-ip"
  | "mail-ip";

export interface AllowanceResult {
  ok: boolean;
  /** Milliseconds until the window resets — for Retry-After, or to say "try again in a minute". */
  retryAfterMs: number;
}

/**
 * Count one event against `scope` + `identifier` and say whether it is within `rule`.
 *
 * Every call counts, allowed or not: a script that keeps pressing after it was refused keeps its own
 * window full, rather than getting a fresh allowance the moment the first one lapses.
 */
export async function takeAllowance(
  scope: AllowanceScope,
  identifier: string,
  rule: AllowanceRule,
  now: Date = new Date(),
): Promise<AllowanceResult> {
  const windowStart = new Date(now.getTime() - rule.windowMs);
  try {
    const [, rows] = await prisma.$transaction([
      prisma.$executeRaw`SELECT set_config('app.bypass', 'on', true)`,
      prisma.$queryRaw<{ failures: number; windowStartedAt: Date }[]>`
        INSERT INTO "LoginAttempt" ("id", "scope", "identifier", "failures", "lockouts", "windowStartedAt", "updatedAt")
        VALUES (${randomUUID()}, ${`pub:${scope}`}, ${identifier}, 1, 0, ${now}, ${now})
        ON CONFLICT ("scope", "identifier") DO UPDATE SET
          "failures" = CASE WHEN "LoginAttempt"."windowStartedAt" <= ${windowStart} THEN 1
                            ELSE "LoginAttempt"."failures" + 1 END,
          "windowStartedAt" = CASE WHEN "LoginAttempt"."windowStartedAt" <= ${windowStart} THEN ${now}
                                   ELSE "LoginAttempt"."windowStartedAt" END,
          "updatedAt" = ${now}
        RETURNING "failures", "windowStartedAt"`,
    ]);
    const row = rows[0];
    if (!row) return { ok: true, retryAfterMs: 0 };
    const resetAt = new Date(row.windowStartedAt).getTime() + rule.windowMs;
    return { ok: row.failures <= rule.limit, retryAfterMs: Math.max(0, resetAt - now.getTime()) };
  } catch {
    return { ok: true, retryAfterMs: 0 };
  }
}
