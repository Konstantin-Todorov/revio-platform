import { prisma } from "./client.js";

/**
 * Is this service actually able to do its job?
 *
 * Written for an EXTERNAL monitor, which changes two things about it.
 *
 * **It must check the database, not just that Node is answering.** A container whose Postgres
 * connection is gone still serves a static page perfectly well, and every screen behind it is
 * broken. On 2026-08-23 a compute cap stopped every service *and* the database; the first anyone
 * knew was a `git push` failing. "The port is open" would have reported healthy through all of it.
 *
 * **It must be cheap and safe to call anonymously.** It is unauthenticated by necessity — a monitor
 * has no session — so the result is cached briefly and the query is the smallest one that proves a
 * round trip. Without the cache, a public endpoint that opens a database connection per request is
 * a way to take the database down by curling it.
 */

export type HealthState = "ok" | "degraded";

export interface HealthResult {
  state: HealthState;
  /** Round-trip time to Postgres in ms, or null when the check failed. */
  dbMs: number | null;
  /** Present only when degraded. Deliberately terse — this is a public response. */
  error?: string;
}

/** Long enough to blunt a flood, short enough that a real outage is noticed on the next poll. */
const CACHE_MS = 10_000;
/** A health check that hangs is a health check that reports nothing. Fail fast and say so. */
const TIMEOUT_MS = 4_000;

let cached: { at: number; result: HealthResult } | null = null;

export async function checkHealth(now = Date.now()): Promise<HealthResult> {
  if (cached && now - cached.at < CACHE_MS) return cached.result;

  const started = Date.now();
  let result: HealthResult;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    result = { state: "ok", dbMs: Date.now() - started };
  } catch (e) {
    // The message is not echoed: a driver error can carry a host, a port, sometimes a user. The
    // monitor needs to know THAT it is broken; the logs say what broke.
    result = {
      state: "degraded",
      dbMs: null,
      error: e instanceof Error && e.message === "timeout" ? "database timeout" : "database unreachable",
    };
  }

  cached = { at: now, result };
  return result;
}
