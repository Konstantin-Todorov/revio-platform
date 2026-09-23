import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease } from "@revio/db";
import { sweepTrials } from "@/lib/trial-sweep";

/**
 * Scheduled entry point for the trial sweep.
 *
 * Warns at seven days and one, then stops access when the clock runs out. A trial that only ends
 * when somebody remembers is a free product.
 *
 * Leased like every other job, and for the usual reason plus one: this one **sends email and revokes
 * access**, so two runners racing could warn a hotel twice or revoke the same entitlement from two
 * directions. The sweep is idempotent anyway — a sent reminder is never sent again, and expiry only
 * touches a trial with no `endedAt` — but a lease costs nothing and makes the log readable.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  try {
    const lease = await withJobLease(JOB.trialSweep, 5 * 60_000, async () => {
      const result = await sweepTrials();
      return { ok: true, ...result };
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("trial-sweep: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
