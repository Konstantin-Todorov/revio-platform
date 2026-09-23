import { NextResponse, type NextRequest } from "next/server";
import { JOB, withJobLease } from "@revio/db";
import { sweepSupportInbox } from "@/lib/support-inbox";

/**
 * Scheduled entry point for the support mailbox.
 *
 * We can send from a ticket thread and, until this existed, could not receive into one: a customer
 * who simply pressed reply was invisible to the system and to themselves. This closes that.
 *
 * Gated on `CRON_SECRET` like every other job route — and note that this is the operator's second
 * job endpoint, which means `api/jobs` must stay exempt in the console's middleware matcher. It was
 * not, once, and `trial-sweep` spent its whole life POSTing into a login page. `jobs-lint` now fails
 * the build if that exemption goes missing again.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }


  try {
    const lease = await withJobLease(JOB.supportInbox, 5 * 60_000, async () => {
      const result = await sweepSupportInbox();
      return result;
    });
    if (!lease.ran) {
      return NextResponse.json({ ok: true, skipped: "another instance holds this job", heldBy: lease.heldBy });
    }
    return NextResponse.json(lease.result);
  } catch (err) {
    console.error("support-inbox: failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
