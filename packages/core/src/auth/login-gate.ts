/**
 * Brute-force protection for the login forms — the decision half, pure and testable.
 *
 * Until this existed, every Revio sign-in page accepted unlimited password attempts, and the
 * operator console was one guessable password away from every hotel's data. bcrypt makes each guess
 * cost ~100ms, which slows an attacker down and does not stop one.
 *
 * Storage lives in `@revio/db` (`loginGate.ts`) so this file stays free of Prisma and can be reasoned
 * about — and argued with — on its own. Every threshold below is a judgement, and judgements rot
 * quietly when they are spread across four `actions-auth.ts` files.
 *
 * ## Two decisions worth stating
 *
 * **Attempts are counted against the email as typed, whether or not an account exists.** Locking only
 * real accounts turns the lockout message into an account-existence oracle: type an address, see
 * whether it can be locked out, learn who banks here. Counting everything costs a few wasted rows and
 * closes that.
 *
 * **Backoff is exponential, and the counter of lockouts decays.** A hotel owner who fumbles their
 * password twice before breakfast should not meet the same wall as something working through a word
 * list. So the first lockout is short and each consecutive one doubles, while an identifier that has
 * been quiet for a day starts again from nothing.
 */

export interface LoginGatePolicy {
  /** Failed attempts allowed inside `windowMs` before the identifier is locked. */
  maxFailures: number;
  /** Rolling window over which failures accumulate. */
  windowMs: number;
  /** Duration of the first lockout. Each consecutive lockout doubles it. */
  baseLockoutMs: number;
  /** Ceiling for the doubling, so an identifier is never locked out indefinitely. */
  maxLockoutMs: number;
  /** Quiet period after which an identifier is treated as brand new (decays `lockouts`). */
  decayAfterMs: number;
}

/**
 * The default policy. 5 attempts is comfortably above honest mistyping and far below useful for
 * guessing; a 1-minute first lockout is barely noticed by a real user and multiplies an attacker's
 * cost by orders of magnitude once it starts doubling.
 */
export const DEFAULT_LOGIN_GATE: LoginGatePolicy = {
  maxFailures: 5,
  windowMs: 15 * 60_000, // 15 minutes
  baseLockoutMs: 60_000, // 1 minute
  maxLockoutMs: 60 * 60_000, // 1 hour
  decayAfterMs: 24 * 60 * 60_000, // 1 day
};

/**
 * Stricter policy for the operator console. Not because operators are less trusted, but because the
 * blast radius is every tenant on the platform rather than one hotel — and there are only ever a
 * handful of operator accounts, so a tighter limit costs nobody anything.
 */
export const OPERATOR_LOGIN_GATE: LoginGatePolicy = {
  ...DEFAULT_LOGIN_GATE,
  maxFailures: 3,
  baseLockoutMs: 5 * 60_000, // 5 minutes
  maxLockoutMs: 4 * 60 * 60_000, // 4 hours
};

/** What we remember about one (app, email) pair. Mirrors the `LoginAttempt` row. */
export interface AttemptState {
  /** Failures inside the current window. */
  failures: number;
  /** When the current window began (epoch ms). */
  windowStartedAt: number;
  /** How many times this identifier has been locked out — drives the exponential backoff. */
  lockouts: number;
  /** Epoch ms until which sign-in is refused, or null when not locked. */
  lockedUntil: number | null;
}

/** The state of an identifier nobody has ever failed to sign in as. */
export function freshState(now: number): AttemptState {
  return { failures: 0, windowStartedAt: now, lockouts: 0, lockedUntil: null };
}

export type GateDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * May this identifier attempt a password right now?
 *
 * Called BEFORE the password is checked, so a locked identifier never reaches bcrypt — which also
 * means a lockout sheds the CPU load an attacker was trying to impose.
 */
// `_policy` is unused today — a lockout is already an absolute timestamp written by `afterFailure`,
// so nothing here needs the policy. Kept in the signature so the three gate functions take the same
// arguments, which is what makes them readable side by side at the call site.
export function checkGate(state: AttemptState, now: number, _policy: LoginGatePolicy): GateDecision {
  if (state.lockedUntil !== null && state.lockedUntil > now) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now };
  }
  return { allowed: true };
}

/**
 * Fold a failed attempt into the state.
 *
 * The window is rolling but not sliding: it resets once `windowMs` has passed since it opened, rather
 * than tracking every timestamp. Five failures a minute apart still lock; five spread over an hour do
 * not. That is the intended trade — the cheap version of this is also the one a person can reason
 * about at 3am.
 */
export function afterFailure(state: AttemptState, now: number, policy: LoginGatePolicy): AttemptState {
  const decayed = decay(state, now, policy);

  // A window that has expired starts over, so honest mistakes months apart never compound.
  const windowExpired = now - decayed.windowStartedAt >= policy.windowMs;
  const failures = (windowExpired ? 0 : decayed.failures) + 1;
  const windowStartedAt = windowExpired ? now : decayed.windowStartedAt;

  if (failures < policy.maxFailures) {
    return { failures, windowStartedAt, lockouts: decayed.lockouts, lockedUntil: null };
  }

  // Threshold reached: lock, and make the next one hurt more.
  const lockouts = decayed.lockouts + 1;
  return {
    failures: 0,
    windowStartedAt: now,
    lockouts,
    lockedUntil: now + lockoutDurationMs(lockouts, policy),
  };
}

/** A correct password clears everything — including the backoff history. */
export function afterSuccess(now: number): AttemptState {
  return freshState(now);
}

/**
 * How long the Nth consecutive lockout lasts: base × 2^(n−1), capped.
 *
 * Exported because the cap is the number that decides whether this is a speed bump or a denial of
 * service against a real user who has forgotten their password, and it deserves its own tests.
 */
export function lockoutDurationMs(lockouts: number, policy: LoginGatePolicy): number {
  if (lockouts <= 0) return 0;
  // Shift rather than Math.pow so a large `lockouts` cannot produce Infinity before the clamp.
  const doublings = Math.min(lockouts - 1, 31);
  const raw = policy.baseLockoutMs * 2 ** doublings;
  return Math.min(raw, policy.maxLockoutMs);
}

/** An identifier quiet for longer than `decayAfterMs` is forgiven its history entirely. */
function decay(state: AttemptState, now: number, policy: LoginGatePolicy): AttemptState {
  const lastActivity = Math.max(state.windowStartedAt, state.lockedUntil ?? 0);
  if (now - lastActivity >= policy.decayAfterMs) return freshState(now);
  return state;
}

/** "in 3 minutes" / "in 45 seconds" — for the one message the user actually sees. */
export function describeRetryAfter(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds < 90) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
