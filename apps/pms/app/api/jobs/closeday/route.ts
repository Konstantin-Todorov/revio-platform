import { NextResponse, type NextRequest } from "next/server";
import { JOB, forSystem, withJobLease } from "@revio/db";
import { autoCloseOverdueDays } from "@/lib/auto-close";

/**
 * Scheduled entry point for the automatic Close Day (round-2 §3).
 *
 * A business day that nobody closes stays open and still due, so unclosed days accumulate: miss
 * seven and the eighth needs closing seven times, and by then the property's daily record is
 * fiction. This sweeps every property, closes any day past its reminder window, and leaves at most
 * one day ever open past its deadline.
 *
 * Every property, deliberately — the whole point is that it runs when nobody is watching, including
 * for hotels nobody has logged into. Runs on the SYSTEM perimeter for the same reason: there is no
 * session, and it must reach tenants no request has arrived for.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // One runner across every replica. This job WRITES a financial close, so a duplicate run is not
  // merely wasteful the way hold-expiry is: two closes would roll the business date twice and skip
  // a day entirely. A generous TTL, because a close across many properties is not instant.
  /*
    ⚠️ `withJobLease`, not a hand-written acquire/release pair.

    This route used to release the lease on the line after the work. If the work threw, the release
    never ran — and because a held lease answers `{ ok: true, skipped: … }`, every tick for the
    next 15 minutes reported SUCCESS while doing nothing. One failure
    silently suppressed the job and told the runner it was fine.

    That is what happened on 2026-09-22: a 500 here, then quiet. `withJobLease` releases on both
    paths, so the next tick retries instead of sitting out the TTL.
  */
  /*
    A failure has to come back with a body. `withJobLease` re-throws whatever the work threw — which
    is right, because the lease must be released and the caller must know the run failed — but with
    nothing catching it Next answers a bare 500 and an EMPTY response. The runner then logs
    `HTTP 500 in 10166ms · ` and nothing after the separator, which is what it logged on 2026-09-22
    and is why that morning's failure took a database query to identify rather than a glance.
  */
  try {
    const lease = await withJobLease(JOB.autoCloseDay, 15 * 60_000, () => autoCloseOverdueDays(forSystem()));
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json({ ok: true, ...lease.result });
  } catch (err) {
    console.error("auto-close-day: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
