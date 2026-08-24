import { checkHealth } from "@revio/db";

export const dynamic = "force-dynamic";

/**
 * Liveness for an external monitor (`.github/workflows/uptime.yml`).
 *
 * Unauthenticated by necessity — a monitor has no session — so it says the minimum that is useful:
 * whether this service can reach the database, and how long that took. No versions, no hostnames, no
 * driver messages. `checkHealth` caches for ten seconds so a public endpoint cannot be turned into a
 * way of exhausting the connection pool.
 *
 * 503 when degraded, not 200-with-a-flag: the monitor, a load balancer and a human reading `curl -I`
 * all understand a status code, and exactly one of them would remember to parse the body.
 */
export async function GET() {
  const health = await checkHealth();
  return Response.json(health, {
    status: health.state === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
