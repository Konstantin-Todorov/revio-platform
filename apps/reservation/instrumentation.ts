/**
 * In-process job scheduler (RevioCRS). Same rationale as the RevioLink one: the container already
 * runs 24/7, so a timer inside the server costs nothing extra and needs no secret distribution.
 *
 * Jobs:
 *  - hold expiry — every 5 minutes. A hold that never expires silently blocks sellable inventory,
 *    so this is the one that must not wait for someone to open the app.
 *  - pickup snapshot — hourly. It is idempotent per day (ensurePickupSnapshot no-ops once written),
 *    so hourly ticks simply guarantee the day gets captured without a precise nightly window.
 */

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.CRON_SECRET) {
    console.warn("[scheduler] CRON_SECRET not set — background jobs are NOT scheduled.");
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const port = process.env.PORT ?? "3002";
  const base = `http://127.0.0.1:${port}`;

  const run = async (path: string) => {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) console.warn(`[scheduler] ${path} → HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[scheduler] ${path} failed:`, e instanceof Error ? e.message : e);
    }
  };

  setTimeout(() => {
    void run("/api/jobs/holds");
    setInterval(() => void run("/api/jobs/holds"), FIVE_MINUTES);

    void run("/api/jobs/pickup");
    setInterval(() => void run("/api/jobs/pickup"), ONE_HOUR);
  }, 30_000);

  console.log("[scheduler] RevioCRS background jobs scheduled (holds 5 min, pickup hourly).");
}

/**
 * Every unhandled server error, recorded once per distinct fault.
 *
 * Next calls this for errors it has already caught and turned into a 500 — the request is lost
 * either way, and the only question is whether anyone finds out. Until now nobody did: it went to a
 * container log that rotates, and the detection mechanism was a hotel ringing to say the screen went
 * white.
 *
 * `recordAppError` never throws — it runs inside the error handler, and a reporter that can throw
 * turns a handled 500 into a crash at exactly the wrong moment. It aggregates by signature, so a bug
 * on a hot route is one row with a count rather than ten thousand rows burying the next bug.
 */
export async function onRequestError(err: unknown, request: { path?: string }): Promise<void> {
  // Node only, and imported through `@revio/db/errors` rather than the main barrel. Instrumentation
  // is bundled for the EDGE runtime too, and the barrel reaches `node:crypto` via the connectivity
  // cipher, the auth tokens and the job lease — none of which the edge bundler can resolve, so the
  // build fails outright. The runtime guard alone is not enough: webpack follows the dynamic import
  // whether or not the branch runs. The subpath keeps `node:crypto` out of the graph entirely.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordAppError } = await import("@revio/db/errors");
  await recordAppError({ service: "crs", error: err, route: request?.path ?? null });
}
