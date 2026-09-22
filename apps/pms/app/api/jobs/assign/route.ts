import { NextResponse, type NextRequest } from "next/server";
import { JOB, forSystem, withJobLease } from "@revio/db";
import { autoAssignAllProperties } from "@/lib/auto-assign";

/**
 * Scheduled entry point for auto-assignment (round-2 §2.3).
 *
 * Every reservation gets a physical room so the calendar can draw all of it and there is no
 * unassigned pile. Runs for every property, on the system perimeter, because it must reach hotels
 * nobody has logged into today — that is precisely when a booking would otherwise sit unplaced.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // One runner. Each individual placement re-checks the room inside its own transaction, so a
  // duplicate run cannot double-book — but it would do the same work twice and write the same
  // audit noise, and there is no reason to.
  /*
    ⚠️ `withJobLease`, not a hand-written acquire/release pair.

    This route used to release the lease on the line after the work. If the work threw, the release
    never ran — and because a held lease answers `{ ok: true, skipped: … }`, every tick for the
    next 10 minutes reported SUCCESS while doing nothing. One failure
    silently suppressed the job and told the runner it was fine.

    That is what happened on 2026-09-22: a 500 here, then quiet. `withJobLease` releases on both
    paths, so the next tick retries instead of sitting out the TTL.
  */
  const lease = await withJobLease(JOB.autoAssign, 10 * 60_000, () => autoAssignAllProperties(forSystem()));
  if (!lease.ran) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }
  return NextResponse.json({ ok: true, ...lease.result });
}
