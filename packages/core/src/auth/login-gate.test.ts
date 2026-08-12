import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_GATE,
  OPERATOR_LOGIN_GATE,
  afterFailure,
  afterSuccess,
  checkGate,
  describeRetryAfter,
  freshState,
  lockoutDurationMs,
  type AttemptState,
  type LoginGatePolicy,
} from "./login-gate.js";

const P = DEFAULT_LOGIN_GATE;
const T0 = 1_700_000_000_000;

/** Fail `n` times back to back, one second apart. */
function failTimes(n: number, policy: LoginGatePolicy = P, start = T0): { state: AttemptState; now: number } {
  let state = freshState(start);
  let now = start;
  for (let i = 0; i < n; i++) {
    now += 1_000;
    state = afterFailure(state, now, policy);
  }
  return { state, now };
}

describe("checkGate", () => {
  it("lets a brand-new identifier through", () => {
    expect(checkGate(freshState(T0), T0, P)).toEqual({ allowed: true });
  });

  it("lets the first four failures through — honest mistyping must not lock anyone out", () => {
    const { state, now } = failTimes(P.maxFailures - 1);
    expect(checkGate(state, now, P)).toEqual({ allowed: true });
  });

  it("locks on the fifth failure", () => {
    const { state, now } = failTimes(P.maxFailures);
    const decision = checkGate(state, now, P);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.retryAfterMs).toBe(P.baseLockoutMs);
  });

  it("opens again the moment the lockout expires", () => {
    const { state, now } = failTimes(P.maxFailures);
    expect(checkGate(state, now + P.baseLockoutMs, P)).toEqual({ allowed: true });
  });
});

describe("exponential backoff", () => {
  it("doubles with each consecutive lockout", () => {
    expect(lockoutDurationMs(1, P)).toBe(P.baseLockoutMs);
    expect(lockoutDurationMs(2, P)).toBe(P.baseLockoutMs * 2);
    expect(lockoutDurationMs(3, P)).toBe(P.baseLockoutMs * 4);
  });

  it("never exceeds the cap — a forgetful owner is not locked out for a week", () => {
    for (const n of [10, 50, 1000, 1e6]) {
      expect(lockoutDurationMs(n, P)).toBe(P.maxLockoutMs);
    }
  });

  it("stays finite for absurd lockout counts (no Infinity before the clamp)", () => {
    expect(Number.isFinite(lockoutDurationMs(5000, P))).toBe(true);
  });

  it("is zero when nothing has been locked", () => {
    expect(lockoutDurationMs(0, P)).toBe(0);
  });

  it("actually escalates across two full lockout cycles", () => {
    let { state, now } = failTimes(P.maxFailures);
    expect(state.lockedUntil).toBe(now + P.baseLockoutMs);

    // Wait out the first lockout, then burn through the threshold again.
    now += P.baseLockoutMs;
    for (let i = 0; i < P.maxFailures; i++) {
      now += 1_000;
      state = afterFailure(state, now, P);
    }
    expect(state.lockouts).toBe(2);
    expect(state.lockedUntil).toBe(now + P.baseLockoutMs * 2);
  });
});

describe("windows and decay", () => {
  it("does not lock when failures are spread beyond the window", () => {
    let state = freshState(T0);
    let now = T0;
    for (let i = 0; i < 20; i++) {
      now += P.windowMs + 1; // each attempt opens a fresh window
      state = afterFailure(state, now, P);
      expect(state.lockedUntil).toBeNull();
    }
  });

  it("forgives an identifier that has been quiet for longer than the decay period", () => {
    const { state, now } = failTimes(P.maxFailures); // locked, lockouts = 1
    expect(state.lockouts).toBe(1);

    // Measured from when the lockout ENDED, not when it started — being locked is not being quiet.
    const muchLater = now + P.baseLockoutMs + P.decayAfterMs + 1;
    const next = afterFailure(state, muchLater, P);
    // History forgotten: this counts as a first failure again, not a second lockout.
    expect(next.lockouts).toBe(0);
    expect(next.failures).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });

  it("does NOT decay while the identifier is still being hammered", () => {
    const { state, now } = failTimes(P.maxFailures);
    const soon = now + 1_000;
    expect(afterFailure(state, soon, P).lockouts).toBe(1); // still remembers
  });
});

describe("success", () => {
  it("clears failures and the backoff history", () => {
    const { state, now } = failTimes(P.maxFailures - 1);
    expect(state.failures).toBeGreaterThan(0);

    const cleared = afterSuccess(now);
    expect(cleared.failures).toBe(0);
    expect(cleared.lockouts).toBe(0);
    expect(cleared.lockedUntil).toBeNull();
    expect(checkGate(cleared, now, P)).toEqual({ allowed: true });
  });
});

describe("the operator policy is strictly tighter", () => {
  it("locks sooner than the hotel policy", () => {
    expect(OPERATOR_LOGIN_GATE.maxFailures).toBeLessThan(DEFAULT_LOGIN_GATE.maxFailures);
  });

  it("locks for longer, at both the first step and the cap", () => {
    expect(OPERATOR_LOGIN_GATE.baseLockoutMs).toBeGreaterThan(DEFAULT_LOGIN_GATE.baseLockoutMs);
    expect(OPERATOR_LOGIN_GATE.maxLockoutMs).toBeGreaterThan(DEFAULT_LOGIN_GATE.maxLockoutMs);
  });

  it("locks the operator console after 3 attempts", () => {
    const { state, now } = failTimes(3, OPERATOR_LOGIN_GATE);
    expect(checkGate(state, now, OPERATOR_LOGIN_GATE).allowed).toBe(false);
  });
});

describe("the cost this actually imposes", () => {
  /**
   * The number this feature exists to change, measured rather than asserted from intuition.
   *
   * The first draft of this test claimed "< 60 guesses/day" and failed at 145 — which is the honest
   * figure, and the reason it is pinned here instead of quietly relaxed. The cap on the backoff means
   * an attacker regains `maxFailures` guesses every `maxLockoutMs`, so a day is worth roughly
   * 24 × 5 + the ramp. That cap is deliberate: an uncapped lockout would let anyone lock a hotel out
   * of its own front desk indefinitely by failing on their email, and a PMS that reception cannot
   * reach during check-in is its own kind of outage.
   */
  function guessesPerDay(policy: LoginGatePolicy): number {
    let state = freshState(T0);
    let now = T0;
    const deadline = T0 + 24 * 60 * 60_000;
    let guesses = 0;

    while (now < deadline) {
      const decision = checkGate(state, now, policy);
      if (decision.allowed) {
        guesses++;
        state = afterFailure(state, now, policy);
        now += 100; // an attacker guessing as fast as bcrypt cost allows
      } else {
        now += decision.retryAfterMs;
      }
    }
    return guesses;
  }

  it("cuts a hotel login from ~864,000 guesses a day to about 145", () => {
    const guesses = guessesPerDay(P);
    expect(guesses).toBeGreaterThan(100); // not so tight it locks real people out permanently
    expect(guesses).toBeLessThan(200);
  });

  it("is a reduction of more than three orders of magnitude", () => {
    const unthrottled = (24 * 60 * 60_000) / 100; // one guess per bcrypt round, all day
    expect(guessesPerDay(P) / unthrottled).toBeLessThan(0.001);
  });

  it("holds the operator console to well under half that", () => {
    expect(guessesPerDay(OPERATOR_LOGIN_GATE)).toBeLessThan(guessesPerDay(P) / 2);
  });
});

describe("describeRetryAfter", () => {
  it("uses seconds, minutes and hours as they become readable", () => {
    expect(describeRetryAfter(1_000)).toBe("1 second");
    expect(describeRetryAfter(30_000)).toBe("30 seconds");
    expect(describeRetryAfter(5 * 60_000)).toBe("5 minutes");
    expect(describeRetryAfter(4 * 60 * 60_000)).toBe("4 hours");
  });

  it("rounds up, so the message is never optimistic", () => {
    expect(describeRetryAfter(1_500)).toBe("2 seconds");
    expect(describeRetryAfter(61_000 + 30_000)).toBe("2 minutes");
  });
});
