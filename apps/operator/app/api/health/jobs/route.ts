import { forSystem } from "@revio/db";

export const dynamic = "force-dynamic";

/**
 * Did the scheduled jobs actually run? A dead-man's switch, for the external monitor.
 *
 * Uptime tells you a service ANSWERS. It cannot tell you that anything happened on a timer, and the
 * scheduler is the part whose failure is silent by construction: `CRON_SECRET` unset, a cron service
 * that never redeployed, a job route renamed. Nothing 500s. Bookings simply stop being pulled and
 * business days stop closing, and the first symptom is a hotel asking why last week never closed.
 *
 * `JobLease.lastRunAt` is bumped on every successful run and already exists, so this is a read.
 *
 * Public, like the liveness check, and it says only what a monitor needs: the job's name, how many
 * seconds since it last succeeded, and whether that is within tolerance. Names are in the repository
 * already; timings reveal nothing about a hotel.
 */

/** The cron runs about every 5 minutes. Six missed cycles is a real fault, not a busy scheduler. */
const STALE_AFTER_SECONDS = 30 * 60;

/**
 * A job that has NEVER run is not reported stale.
 *
 * Right after this ships, or right after a new job is added, there is no row — and a monitor that
 * screams on first deploy is a monitor someone mutes. Absence is reported as `never`, visible in the
 * body, without failing the check. A job that ran once and then stopped is the real signal.
 */
export async function GET() {
  const leases = await forSystem().jobLease.findMany({
    select: { name: true, lastRunAt: true },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const jobs = leases.map((l) => {
    const ageSeconds = l.lastRunAt ? Math.round((now - l.lastRunAt.getTime()) / 1000) : null;
    return {
      name: l.name,
      ageSeconds,
      state: ageSeconds === null ? "never" : ageSeconds > STALE_AFTER_SECONDS ? "stale" : "ok",
    };
  });

  const stale = jobs.filter((j) => j.state === "stale");
  return Response.json(
    { state: stale.length ? "degraded" : "ok", staleAfterSeconds: STALE_AFTER_SECONDS, jobs },
    { status: stale.length ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
