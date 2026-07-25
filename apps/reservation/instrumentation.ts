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
