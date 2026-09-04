import { forSystem } from "@revio/db";
import { jobHealth } from "@/lib/job-health";

export const dynamic = "force-dynamic";

/**
 * Did the scheduled jobs actually run? A dead-man's switch, for the external monitor.
 *
 * Uptime tells you a service ANSWERS. It cannot tell you that anything happened on a timer, and the
 * scheduler is the part whose failure is silent by construction: `CRON_SECRET` unset, a cron service
 * that never redeployed, a job route renamed, a new job whose cron entry was never added. Nothing
 * 500s. Bookings simply stop being pulled and business days stop closing, and the first symptom is a
 * hotel asking why last week never closed.
 *
 * The reading itself is in `@/lib/job-health` — pure and tested, because the last version of this
 * logic was neither, and it could not see the one failure above that has no database row behind it.
 * This handler is the read and the status code, nothing else.
 *
 * Public, like the liveness check, and it says only what a monitor needs: the job's name, how many
 * seconds since it last succeeded, and whether that is within tolerance. Names are in the repository
 * already; timings reveal nothing about a hotel.
 */
export async function GET() {
  const leases = await forSystem().jobLease.findMany({
    select: { name: true, lastRunAt: true },
    orderBy: { name: "asc" },
  });

  const report = jobHealth(leases, new Date());

  return Response.json(report, {
    status: report.state === "degraded" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
