/**
 * Abuse protection for the public booking surface.
 *
 * This is the first unauthenticated, internet-facing, inventory-touching endpoint the platform has.
 * The threat that matters is not scraping — it is **hold exhaustion**: a hold takes a room off sale
 * for its TTL, so a trivial script looping the create-hold endpoint could take a small hotel's entire
 * inventory off every channel for as long as it keeps running. That is a denial of *revenue*, and it
 * would be indistinguishable from a sold-out weekend until someone noticed the bookings never came.
 *
 * So this ships with the shell (K1), not as hardening later.
 *
 * Two different limits, because the two risks differ:
 *   - SEARCH is cheap to serve and legitimate users repeat it while choosing dates → generous.
 *   - HOLD consumes real inventory → strict, and additionally capped per property so that even a
 *     distributed attempt (many IPs) cannot lock out a whole hotel.
 *
 * In-memory by design for now: one process per Railway service, and a limiter that fails open on
 * restart is the right trade against a limiter that needs Redis to be up before a guest can book.
 * When the booking service scales past one instance this moves behind Redis — the interface here
 * does not change, which is why it is a module rather than inline code.
 */

export interface RateLimitRule {
  /** Max events allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const SEARCH_LIMIT: RateLimitRule = { limit: 60, windowMs: 60_000 };
export const HOLD_PER_IP: RateLimitRule = { limit: 6, windowMs: 10 * 60_000 };
/** A ceiling no single property can exceed regardless of how many IPs are involved. */
export const HOLD_PER_PROPERTY: RateLimitRule = { limit: 40, windowMs: 10 * 60_000 };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound when many distinct keys appear (each IP is a key). */
const MAX_KEYS = 20_000;

function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Events still allowed in this window. */
  remaining: number;
  /** When the window resets, epoch ms — surfaced as Retry-After. */
  resetAt: number;
}

/**
 * Count one event against `key`. Fixed-window: simple, predictable, and the burst it permits at a
 * window boundary is irrelevant at these limits.
 */
export function hit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_KEYS) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + rule.windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: rule.limit - 1, resetAt: fresh.resetAt };
  }

  existing.count += 1;
  const remaining = rule.limit - existing.count;
  return { ok: remaining >= 0, remaining: Math.max(0, remaining), resetAt: existing.resetAt };
}

/** Read a limit without consuming it — for surfacing state, never for deciding. */
export function peek(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { ok: true, remaining: rule.limit, resetAt: now + rule.windowMs };
  return { ok: b.count < rule.limit, remaining: Math.max(0, rule.limit - b.count), resetAt: b.resetAt };
}

/** Test seam — the limiter is process-global, so tests must be able to reset it. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/**
 * The client's address behind Railway's proxy. `x-forwarded-for` is a comma-separated chain and only
 * the FIRST entry is the original client; taking the last would let a caller spoof its own identity
 * by sending the header. Falls back to a constant so a missing header degrades to a shared bucket
 * (stricter) rather than to no limit at all.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Guard a search request. */
export function checkSearch(ip: string, propertySlug: string): RateLimitResult {
  return hit(`search:${propertySlug}:${ip}`, SEARCH_LIMIT);
}

/**
 * Guard a hold request against BOTH limits. The per-property ceiling is checked first and only
 * consumed if the per-IP check passes, so one abusive IP cannot burn the whole property's allowance
 * and lock out genuine guests.
 */
export function checkHold(ip: string, propertyId: string): RateLimitResult & { scope: "ip" | "property" | null } {
  const perIp = hit(`hold:ip:${propertyId}:${ip}`, HOLD_PER_IP);
  if (!perIp.ok) return { ...perIp, scope: "ip" };

  const perProperty = hit(`hold:prop:${propertyId}`, HOLD_PER_PROPERTY);
  if (!perProperty.ok) return { ...perProperty, scope: "property" };

  return { ...perIp, scope: null };
}
