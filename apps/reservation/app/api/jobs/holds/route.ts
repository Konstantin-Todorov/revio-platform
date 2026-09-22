import { NextResponse, type NextRequest } from "next/server";
import { JOB, acquireJobLease, forSystem, releaseJobLease } from "@revio/db";
import { releaseExpiredHolds } from "@/lib/holds";

/** Scheduled entry point for hold expiry (all tenants). Lazy page-load runs cover the demo;
 *  this route is the every-few-minutes cron when real traffic arrives. */
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
   * This job frees held inventory — harmless to repeat, but there is no reason to.
   *
   * Losing the lease is the NORMAL outcome on every replica but one, so it reports ok+skipped
   * rather than an error. If the body throws, the lease is deliberately NOT released — a run that
   * failed should wait out the short TTL rather than be retried instantly by the next tick.
   */
  const lease = await acquireJobLease(JOB.holdExpiry, 5 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }
  /*
    ⚠️ The work runs inside a try whose RETURN is also inside it.

    That detail is the whole fix: wrapping only the statements and leaving the return outside puts
    every variable the return reads out of scope, which is exactly how the first attempt at this
    broke. Typecheck caught it; it is recorded here so the next person does not repeat it.

    What this does NOT change is the lease. The comment above states that a failed run deliberately
    waits out its TTL instead of being retried on the next tick, and that is a decision, not an
    oversight — it is not overridden here. See `docs/ACTION-REQUIRED.md` for the contradiction it
    sits in.

    What it changes is that a failure can be READ. Without a catch, Next answers a bare 500 with an
    EMPTY body, and the runner logged exactly that on 2026-09-22: `HTTP 500 in 10166ms · ` and
    nothing after the separator. An error nobody can see is an error nobody fixes.
  */
  try {    const released = await releaseExpiredHolds(forSystem());
    await releaseJobLease(JOB.holdExpiry);
    return NextResponse.json({ ok: true, released });
  } catch (err) {
    console.error("hold-expiry: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
