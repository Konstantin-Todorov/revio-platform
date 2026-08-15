import { randomUUID } from "node:crypto";
import { forSystem } from "./rls.js";

/**
 * One runner per job, across every process (CX1).
 *
 * ## Why this exists
 *
 * Channex asked: *"Can you check why you do multiple feed calls at the same time?"* Their timeline
 * for one booking showed the same revision delivered twice inside one second, from two different IP
 * addresses — two of our processes polling their feed concurrently.
 *
 * The cause is `instrumentation.ts`: the scheduler runs **inside the web server**, so there is one
 * timer per server process. A second Railway replica, a developer running the app against the same
 * sandbox, or a certification script running while the deployed app ticks — each is another poller.
 *
 * The scheduler's own comment said this was safe because the jobs are idempotent. That was true and
 * beside the point: idempotency protects *our* database. It says nothing about a partner's rate
 * limit, or about what their engineers see in their logs when they are deciding whether to certify
 * us.
 *
 * ## Why a lease row and not a lock
 *
 * A Postgres advisory lock is the obvious tool and does not fit: it lives on a connection, and
 * Prisma hands out pooled connections per query, so a lock taken for a job that makes dozens of
 * network calls cannot be held. Holding a transaction open for the whole pull is worse.
 *
 * A lease is a row with an expiry. Taking it is one conditional UPDATE, which Postgres makes atomic,
 * so exactly one caller wins. If the holder crashes, the lease simply expires and the next tick
 * takes over — there is no flag for a human to clear at 3am, which is the failure mode of every
 * "isRunning" boolean ever written.
 */

/** Identifies the process holding a lease. Only ever read by a person debugging a stuck job. */
const HOLDER = `${process.env.RAILWAY_REPLICA_ID ?? process.env.HOSTNAME ?? "local"}:${process.pid}:${randomUUID().slice(0, 8)}`;

export interface LeaseResult {
  /** True when this process may run the job. */
  acquired: boolean;
  /** Who holds it instead — for the log line that tells you which box is looping. */
  heldBy?: string;
  heldUntil?: Date;
}

/**
 * Try to take the lease for `name`.
 *
 * `ttlMs` must comfortably exceed the job's worst-case runtime: a lease that expires mid-run lets a
 * second process start, which is the exact thing this prevents. It must also not be so long that a
 * crashed instance blocks the job for hours. For a 5-minute poll, a few minutes is right.
 */
export async function acquireJobLease(name: string, ttlMs: number): Promise<LeaseResult> {
  const db = forSystem();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  /*
   * The atomic part, and deliberately FIRST.
   *
   * `updateMany` with `expiresAt <= now` compiles to a single UPDATE … WHERE, so two processes
   * racing here produce exactly one row updated and one row untouched.
   *
   * Ordering matters for a reason that only shows up in production logs: the obvious version tries
   * `create` first and catches the unique-constraint violation. That works, but Prisma logs the
   * violation as an error regardless of the catch — so every replica but one would print a database
   * error every five minutes, and the log that is supposed to tell you something is wrong would be
   * full of the system working correctly. Taking the update path first means `create` runs once in
   * the lifetime of a job, not on every tick.
   */
  const { count } = await db.jobLease.updateMany({
    where: { name, expiresAt: { lte: now } },
    data: { holder: HOLDER, expiresAt, acquiredAt: now },
  });
  if (count === 1) return { acquired: true };

  const current = await db.jobLease.findUnique({ where: { name } });
  if (current) return { acquired: false, heldBy: current.holder, heldUntil: current.expiresAt };

  // No row at all — the very first run of this job. A concurrent create loses on the primary key,
  // which is correct: the loser simply does not hold the lease.
  try {
    await db.jobLease.create({ data: { name, holder: HOLDER, expiresAt } });
    return { acquired: true };
  } catch {
    const winner = await db.jobLease.findUnique({ where: { name } });
    return {
      acquired: false,
      ...(winner ? { heldBy: winner.holder, heldUntil: winner.expiresAt } : {}),
    };
  }
}

/**
 * Give the lease back so the next tick can run immediately rather than waiting out the TTL.
 *
 * Only releases a lease this process actually holds — otherwise a slow job that already lost its
 * lease would yank it out from under whoever legitimately took over.
 */
export async function releaseJobLease(name: string, ranSuccessfully = true): Promise<void> {
  const db = forSystem();
  await db.jobLease.updateMany({
    where: { name, holder: HOLDER },
    data: {
      expiresAt: new Date(0),
      ...(ranSuccessfully ? { lastRunAt: new Date() } : {}),
    },
  });
}

/**
 * Run `fn` only if this process can take the lease.
 *
 * Returns `{ ran: false }` when another process holds it — which is a normal, expected outcome on
 * every replica but one, not an error. The caller decides whether that is worth logging.
 */
export async function withJobLease<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ ran: true; result: T } | { ran: false; heldBy?: string }> {
  const lease = await acquireJobLease(name, ttlMs);
  if (!lease.acquired) {
    return { ran: false, ...(lease.heldBy ? { heldBy: lease.heldBy } : {}) };
  }
  try {
    const result = await fn();
    await releaseJobLease(name, true);
    return { ran: true, result };
  } catch (err) {
    // Release on failure too: the next tick should retry promptly rather than sit out the TTL
    // because one run threw.
    await releaseJobLease(name, false);
    throw err;
  }
}

/** The job names in use. Named here so a typo is a compile error rather than a second poller. */
export const JOB = {
  /** The Channex booking-revisions feed. The one Channex complained about. */
  channexPull: "channex-pull",
  arrivalsDigest: "arrivals-digest",
  holdExpiry: "hold-expiry",
  pickupSnapshot: "pickup-snapshot",
} as const;
