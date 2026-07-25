/**
 * In-process job scheduler (RevioLink).
 *
 * Why in-process rather than an external cron: our Railway containers already run 24/7, so a timer
 * inside the server costs nothing extra, needs no shared secret distribution, and has no second
 * service to keep alive. (GitHub Actions bills per-minute rounded up — a 5-minute cron on a private
 * repo would be ~8,600 billed minutes/month. A Railway cron service works too but is another
 * service to run and pay for.)
 *
 * Safety: every job behind these ticks is IDEMPOTENT (the arrivals digest dedupes per property/day,
 * the pull upserts by external id), so an extra tick — or a second replica — cannot double-charge or
 * double-email. Failures are swallowed and simply retried on the next tick.
 *
 * Next.js calls register() once per server process (Next 15 stable instrumentation hook).
 */

const FIVE_MINUTES = 5 * 60 * 1000;

export async function register() {
  // Only the Node.js server runtime — not edge, not the build step.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A missing secret means the routes would 401 anyway; skip rather than hammer them.
  if (!process.env.CRON_SECRET) {
    console.warn("[scheduler] CRON_SECRET not set — background jobs are NOT scheduled.");
    return;
  }
  // Don't run timers during `next build`/prerender passes.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const port = process.env.PORT ?? "3000";
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

  const tick = async () => {
    await run("/api/jobs/pull"); // OTA bookings must arrive without anyone opening the app
    await run("/api/jobs/arrivals"); // arrival digests at each property's configured local time
  };

  // Let the server finish booting before the first tick.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), FIVE_MINUTES);
  }, 30_000);

  console.log("[scheduler] RevioLink background jobs scheduled (pull + arrivals, every 5 min).");
}
