import { describe, it, expect } from "vitest";
import {
  TRIAL_DAYS,
  daysRemaining,
  dueReminder,
  needsExpiring,
  trialEndsAt,
  trialOutcomeLabel,
  trialState,
  type TrialFacts,
} from "./trials";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

function trial(over: Partial<TrialFacts> = {}): TrialFacts {
  return { product: "pms", endsAt: inDays(20), endedAt: null, remindedDays: [], ...over };
}

describe("trialState — expired and ended are not the same thing", () => {
  it("is active with three weeks left", () => {
    expect(trialState(trial(), NOW)).toBe("active");
  });

  it("is ending-soon inside the first warning window", () => {
    expect(trialState(trial({ endsAt: inDays(5) }), NOW)).toBe("ending-soon");
  });

  it("is EXPIRED when the clock ran out and nothing has acted yet", () => {
    // Access is still on. This is the state the sweep exists to find.
    expect(trialState(trial({ endsAt: inDays(-1) }), NOW)).toBe("expired");
  });

  it("is ENDED once somebody closed it", () => {
    // History. Collapsing this with `expired` would hide the state that needs a job to run.
    expect(trialState(trial({ endsAt: inDays(-1), endedAt: inDays(-1) }), NOW)).toBe("ended");
  });

  it("counts an ended trial as ended even before its end date", () => {
    expect(trialState(trial({ endsAt: inDays(10), endedAt: NOW }), NOW)).toBe("ended");
  });
});

describe("daysRemaining — rounds up", () => {
  it("calls four hours left one day", () => {
    // "0 days left" while they still have access is the small wrongness that discredits every other
    // number on the screen.
    expect(daysRemaining(trial({ endsAt: new Date(NOW.getTime() + 4 * 3_600_000) }), NOW)).toBe(1);
  });

  it("is zero once it has passed", () => {
    expect(daysRemaining(trial({ endsAt: inDays(-2) }), NOW)).toBe(0);
  });

  it("counts whole days", () => {
    expect(daysRemaining(trial({ endsAt: inDays(7) }), NOW)).toBe(7);
  });
});

describe("dueReminder — never twice, and never the wrong one", () => {
  it("sends nothing when there is plenty of time", () => {
    expect(dueReminder(trial({ endsAt: inDays(20) }), NOW)).toBeNull();
  });

  it("sends the seven-day warning inside a week", () => {
    expect(dueReminder(trial({ endsAt: inDays(6) }), NOW)).toBe(7);
  });

  it("never sends the same reminder twice", () => {
    // What makes running the sweep repeatedly harmless.
    expect(dueReminder(trial({ endsAt: inDays(6), remindedDays: [7] }), NOW)).toBeNull();
  });

  it("sends the most urgent one after a gap, not the stalest", () => {
    // A sweep that has not run for a week must not send "7 days left" on the final day.
    expect(dueReminder(trial({ endsAt: inDays(1), remindedDays: [] }), NOW)).toBe(1);
  });

  it("still sends the last warning after the first one went out", () => {
    expect(dueReminder(trial({ endsAt: inDays(1), remindedDays: [7] }), NOW)).toBe(1);
  });

  it("never sends a stale seven-day warning after the one-day warning", () => {
    // A missed older threshold stays missed; running the sweep again must not move backwards.
    expect(dueReminder(trial({ endsAt: inDays(1), remindedDays: [1] }), NOW)).toBeNull();
  });

  it("sends nothing once it has expired", () => {
    // Past the end there is no warning left to give — there is an expiry to perform.
    expect(dueReminder(trial({ endsAt: inDays(-1) }), NOW)).toBeNull();
  });

  it("sends nothing for a trial somebody already closed", () => {
    expect(dueReminder(trial({ endsAt: inDays(1), endedAt: NOW }), NOW)).toBeNull();
  });
});

describe("needsExpiring — the sweep's only question", () => {
  it("is true when the clock ran out and nothing acted", () => {
    expect(needsExpiring(trial({ endsAt: inDays(-1) }), NOW)).toBe(true);
  });

  it("is false before the end", () => {
    expect(needsExpiring(trial({ endsAt: inDays(1) }), NOW)).toBe(false);
  });

  it("is false once ended, so a second sweep cannot revoke twice", () => {
    expect(needsExpiring(trial({ endsAt: inDays(-5), endedAt: inDays(-5) }), NOW)).toBe(false);
  });
});

describe("trialEndsAt", () => {
  it("defaults to the stated trial length", () => {
    expect(trialEndsAt(NOW).toISOString()).toBe(inDays(TRIAL_DAYS).toISOString());
  });

  it("never produces a trial that has already finished", () => {
    expect(trialEndsAt(NOW, 0).getTime()).toBeGreaterThan(NOW.getTime());
    expect(trialEndsAt(NOW, -10).getTime()).toBeGreaterThan(NOW.getTime());
  });
});

describe("trialOutcomeLabel", () => {
  it("names each ending in words a person would use", () => {
    expect(trialOutcomeLabel("converted")).toBe("Kept it");
    expect(trialOutcomeLabel("expired")).toBe("Ran out");
    expect(trialOutcomeLabel("cancelled")).toBe("Stopped early");
    expect(trialOutcomeLabel(null)).toBe("Running");
  });
});
