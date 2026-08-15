/**
 * The storage half of login brute-force protection — the memory behind `@revio/core`'s decisions.
 *
 * Kept here rather than in each app's `actions-auth.ts` because four apps need identical behaviour
 * and a rate limiter that differs subtly per app is a rate limiter with a hole in it.
 *
 * Everything runs through `forSystem()`. That looks alarming next to the rest of this package and is
 * correct here: `LoginAttempt` carries no `tenantId` and no RLS policy, because a login attempt
 * happens before any tenant context exists. There is no session to scope to and nothing tenant-owned
 * in the row — an email someone typed, and a count.
 */
import { forSystem } from "./rls.js";
import {
  DEFAULT_LOGIN_GATE,
  afterFailure,
  checkGate,
  describeRetryAfter,
  freshState,
  type AttemptState,
  type LoginGatePolicy,
} from "@revio/core";
// `afterSuccess` is deliberately not imported: `recordLoginSuccess` deletes the row outright, which
// is the same outcome (the next read gets `freshState`) and leaves nothing behind to prune.

/**
 * Which form an attempt was made against.
 *
 * The `reset-*` scopes share this table because they need the identical thing: a per-address counter
 * that survives a deploy. What they throttle is different — not password guessing, but using our
 * mail server to flood someone's inbox, which is both an abuse of us and a way to bury a real
 * security alert under noise.
 */
export type LoginScope =
  | "cm"
  | "crs"
  | "pms"
  | "operator"
  | "reset-cm"
  | "reset-crs"
  | "reset-pms"
  | "reset-operator";

export interface GateResult {
  allowed: boolean;
  /** Ready-to-show message when `allowed` is false. */
  message?: string;
  retryAfterMs?: number;
}

/**
 * Normalize what the user typed into the key we count against.
 *
 * Lowercased and trimmed so `Admin@Hotel.com ` and `admin@hotel.com` are one bucket rather than two —
 * otherwise varying the capitalisation multiplies an attacker's allowance by every spelling of the
 * same address.
 */
function key(identifier: string): string {
  return identifier.trim().toLowerCase();
}

async function load(scope: LoginScope, identifier: string, now: number): Promise<AttemptState> {
  const row = await forSystem().loginAttempt.findUnique({
    where: { scope_identifier: { scope, identifier: key(identifier) } },
  });
  if (!row) return freshState(now);
  return {
    failures: row.failures,
    windowStartedAt: row.windowStartedAt.getTime(),
    lockouts: row.lockouts,
    lockedUntil: row.lockedUntil ? row.lockedUntil.getTime() : null,
  };
}

async function save(scope: LoginScope, identifier: string, state: AttemptState): Promise<void> {
  const data = {
    failures: state.failures,
    lockouts: state.lockouts,
    windowStartedAt: new Date(state.windowStartedAt),
    lockedUntil: state.lockedUntil === null ? null : new Date(state.lockedUntil),
  };
  await forSystem().loginAttempt.upsert({
    where: { scope_identifier: { scope, identifier: key(identifier) } },
    create: { scope, identifier: key(identifier), ...data },
    update: data,
  });
}

/**
 * Ask whether this email may try a password right now. Call BEFORE verifying it, so a locked
 * identifier never reaches bcrypt — which also sheds the CPU cost an attacker was trying to impose.
 *
 * Fails OPEN if the database is unreachable. That is a deliberate trade and the uncomfortable one:
 * a Postgres blip would otherwise lock every hotel out of its own front desk during check-in. The
 * password check itself needs the same database, so an attacker gains nothing from the outage that
 * they did not already have.
 */
export async function checkLoginAllowed(
  scope: LoginScope,
  identifier: string,
  policy: LoginGatePolicy = DEFAULT_LOGIN_GATE,
): Promise<GateResult> {
  const now = Date.now();
  try {
    const decision = checkGate(await load(scope, identifier, now), now, policy);
    if (decision.allowed) return { allowed: true };
    return {
      allowed: false,
      retryAfterMs: decision.retryAfterMs,
      message: `Too many failed attempts. Try again in ${describeRetryAfter(decision.retryAfterMs)}.`,
    };
  } catch {
    return { allowed: true };
  }
}

/** Record a wrong password. Never throws — a failed write must not turn into a 500 on a login form. */
export async function recordLoginFailure(
  scope: LoginScope,
  identifier: string,
  policy: LoginGatePolicy = DEFAULT_LOGIN_GATE,
): Promise<void> {
  const now = Date.now();
  try {
    await save(scope, identifier, afterFailure(await load(scope, identifier, now), now, policy));
  } catch {
    /* counting is best-effort; the sign-in result is what matters to the caller */
  }
}

/** Clear the record on a correct password, including the backoff history. */
export async function recordLoginSuccess(scope: LoginScope, identifier: string): Promise<void> {
  try {
    await forSystem().loginAttempt.deleteMany({ where: { scope, identifier: key(identifier) } });
  } catch {
    /* best-effort */
  }
}

/**
 * Drop rows that have decayed to meaninglessness. Without this, spraying invented addresses grows the
 * table forever — cheap for the attacker, permanent for us.
 */
export async function pruneLoginAttempts(olderThanMs = 7 * 24 * 60 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await forSystem().loginAttempt.deleteMany({
    where: { updatedAt: { lt: cutoff }, lockedUntil: null },
  });
  return count;
}
