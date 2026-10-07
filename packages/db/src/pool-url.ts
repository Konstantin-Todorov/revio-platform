/**
 * Cap each service's Prisma connection pool.
 *
 * ⚠️ Production ran out of connections on 2026-10-07 ("too many clients already"), and the Operator
 * console was the screen it showed on. Prisma's default pool is `2 × CPUs + 1` per process, and a
 * Railway container reports many CPUs — six services, plus the old copy of each that stays up while
 * a deploy rolls over, filled Postgres's 100 slots with idle connections.
 *
 * The cap goes into the URL rather than into each service's settings, so it cannot be forgotten on
 * the next service someone adds. A URL that already says `connection_limit` keeps its own value.
 */
export function withPoolLimit(url: string | undefined, limit: number): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}&pool_timeout=20`;
}

/** Five connections per process unless `DB_POOL_SIZE` says otherwise. */
export function poolSize(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.DB_POOL_SIZE ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}
