import { NextResponse, type NextRequest } from "next/server";
import { JOB, acquireJobLease, forSystem, releaseJobLease } from "@revio/db";
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
  const lease = await acquireJobLease(JOB.autoAssign, 10 * 60_000);
  if (!lease.acquired) {
    return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
  }

  const result = await autoAssignAllProperties(forSystem());
  await releaseJobLease(JOB.autoAssign);
  return NextResponse.json({ ok: true, ...result });
}
