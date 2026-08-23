import { NextResponse, type NextRequest } from "next/server";
import { JOB, acquireJobLease, forSystem, releaseJobLease } from "@revio/db";
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
  const lease = await acquireJobLease(JOB.autoCloseDay, 15 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }

  const result = await autoCloseOverdueDays(forSystem());
  await releaseJobLease(JOB.autoCloseDay);
  return NextResponse.json({ ok: true, ...result });
}
