import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease, forSystem } from "@revio/db";
import { ensurePickupSnapshot } from "@/lib/pickup";

/**
 * Scheduled entry point for the nightly pickup snapshot (all tenants — system perimeter).
 * The same job also runs lazily on Dashboard/Inventory loads, so this route is a safety net for
 * days nobody logs in. Gate: CRON_SECRET must be set and match the bearer token.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  /*
   * CX1 — exactly one runner for this job, across every process.
   *
   * The scheduler lives in `instrumentation.ts`, i.e. INSIDE the web server, so there is one timer
   * per server process. A second Railway replica, a developer pointed at the same sandbox, or a
   * certification script running while the deployed app ticks is each another runner. Channex saw
   * the consequence and asked about it directly: the same booking revision delivered twice within
   * one second, from two different IP addresses.
   *
   * This job writes one snapshot per day — a second runner is pure waste.
   *
   * Losing the lease is the NORMAL outcome on every replica but one, so it reports ok+skipped
   * rather than an error. If the body throws, the lease is released anyway so the next
   * tick retries — see the note on `withJobLease` below.
   */
  /*
    ⚠️ The work runs inside a try whose RETURN is also inside it.

    That detail is the whole fix: wrapping only the statements and leaving the return outside puts
    every variable the return reads out of scope, which is exactly how the first attempt at this
    broke. Typecheck caught it; it is recorded here so the next person does not repeat it.

    ⚠️ ONE lease policy since 2026-09-23: `withJobLease`, releasing on both paths and stamping
    `lastRunAt` only on success. This route used to keep its lease after a failure so a failed
    run would "wait out its TTL". Measured against the real 10-minute cron that backoff mostly
    did not exist — a 5-minute TTL has expired before the next tick — and where it did (10-minute
    TTLs) it skipped a tick at random and reported the skip as `ok: true`. Decided by the founder;
    the table is in `docs/ACTION-REQUIRED.md` §2d, and `jobs-lint` now refuses a hand-held lease.

    What the catch changes is that a failure can be READ. Without a catch, Next answers a bare 500 with an
    EMPTY body, and the runner logged exactly that on 2026-09-22: `HTTP 500 in 10166ms · ` and
    nothing after the separator. An error nobody can see is an error nobody fixes.
  */
  try {
    const lease = await withJobLease(JOB.pickupSnapshot, 10 * 60_000, async () => {
      await ensurePickupSnapshot(forSystem());
      return { ok: true };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("pickup-snapshot: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
