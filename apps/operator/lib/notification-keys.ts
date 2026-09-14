// Plain module (no "use server") so it can be unit-tested — a "use server" file may only export
// async functions, and an input validator that cannot be tested is one nobody has checked.

/** How many individually-read keys an account keeps. The marker covers everything older. */
export const MAX_READ_KEYS = 200;

/**
 * ⚠️ Is this a notification key, or is it something somebody typed into a POST?
 *
 * `markNotificationRead` appends to an array column on the accounts table, so an unvalidated key is
 * a way to write arbitrary bytes into `User` one call at a time — a slow, quiet, and entirely
 * avoidable way to fill a database. The shape is `<source>:<row id>`, the id is a cuid, and nothing
 * else is accepted.
 */
export function isNotificationKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-z][a-z_]{0,19}:[A-Za-z0-9_-]{1,40}$/.test(key);
}

/**
 * Keep the newest keys and drop the rest.
 *
 * Losing the oldest is harmless: anything old enough to fall off is older than the last "mark all
 * read" in every practical case, and the worst outcome is one already-seen line showing bold again.
 * An unbounded column on every account row is the outcome worth avoiding.
 */
export function pruneReadKeys(keys: readonly string[]): string[] {
  return keys.slice(-MAX_READ_KEYS);
}
