import { describe, it, expect } from "vitest";
import { readTrial, trialsByUrgency, type TrialProductUsage, type TrialReadingFacts } from "./trial-reading.js";

const START = new Date("2026-09-01T00:00:00Z");
const ENDS = new Date("2026-10-01T00:00:00Z");

const use = (product: TrialProductUsage["product"], activeDays: number, people = 1, views = activeDays * 10): TrialProductUsage =>
  ({ product, activeDays, people, views });

function facts(over: Partial<TrialReadingFacts> = {}): TrialReadingFacts {
  return {
    startedAt: START, endsAt: ENDS, endedAt: null, outcome: null, keepRequestedAt: null,
    usage: [], lastSeenDaysAgo: null, now: new Date("2026-09-10T00:00:00Z"), ...over,
  };
}

describe("readTrial", () => {
  it("⚠️ names the product they USED, not the one they asked for", () => {
    // The whole payoff of giving all three: a hotel that signed up "for the channel manager" and
    // lived in the front desk is a PMS sale, and their own usage is the argument.
    const r = readTrial(facts({
      usage: [use("cm", 1), use("pms", 9, 3)],
      lastSeenDaysAgo: 0,
    }));
    expect(r.strongest?.key).toBe("pms");
    expect(r.headline).toContain("RevioPMS");
  });

  it("⚠️ refuses to call an unopened trial an opportunity", () => {
    // Reading "sell them RevioPMS" off four page views would be inventing a signal out of noise.
    const r = readTrial(facts({ now: new Date("2026-09-20T00:00:00Z"), usage: [], lastSeenDaysAgo: null }));
    expect(r.verdict).toBe("never_opened");
    expect(r.strongest).toBeNull();
    expect(r.action).toMatch(/rescue, not a sale/i);
  });

  it("says nothing about a trial that is two days old and quiet", () => {
    // Somebody signed up on a Friday. Nothing is wrong and saying something would be noise.
    const r = readTrial(facts({ now: new Date("2026-09-02T00:00:00Z") }));
    expect(r.verdict).toBe("never_opened");
    expect(r.action).toBeNull();
    expect(r.urgency).toBe("none");
  });

  it("⚠️ treats silence by how much CLOCK is left, not by a fixed fortnight", () => {
    // engagementOf calls two silent weeks "quiet" for a customer. On a 30-day trial, five silent
    // days near the end is most of the remaining chance gone.
    const early = readTrial(facts({ now: new Date("2026-09-08T00:00:00Z"), usage: [use("cm", 3)], lastSeenDaysAgo: 5 }));
    const late = readTrial(facts({ now: new Date("2026-09-27T00:00:00Z"), usage: [use("cm", 3)], lastSeenDaysAgo: 5 }));
    expect(early.verdict).toBe("drifting");
    expect(late.verdict).toBe("drifting");
    expect(early.urgency).toBe("soon");
    expect(late.urgency).toBe("now"); // 4 days left
    expect(late.action).toMatch(/4 days left/);
  });

  it("asks for the order only when there is real, shared use AND the clock is short", () => {
    const strong = { usage: [use("crs", 12, 3)], lastSeenDaysAgo: 0 };
    const early = readTrial(facts({ ...strong, now: new Date("2026-09-12T00:00:00Z") }));
    const late = readTrial(facts({ ...strong, now: new Date("2026-09-25T00:00:00Z") }));
    expect(early.verdict).toBe("landing");
    expect(early.action).toMatch(/let it run/i);
    expect(late.action).toMatch(/Ask for the order/);
  });

  it("one person poking about is not a hotel adopting it", () => {
    // `people >= 2` is the difference between an owner having a look and a team using it.
    const r = readTrial(facts({ usage: [use("crs", 9, 1)], lastSeenDaysAgo: 0 }));
    expect(r.verdict).toBe("exploring");
  });

  it("⚠️ a keep request stops the analysis — somebody is waiting", () => {
    const r = readTrial(facts({ keepRequestedAt: new Date(), usage: [use("cm", 8, 2)], lastSeenDaysAgo: 0 }));
    expect(r.verdict).toBe("asked_to_keep");
    expect(r.urgency).toBe("now");
    expect(r.action).toMatch(/Reply/);
  });

  it("an expired trial that was used properly is still worth a call", () => {
    const r = readTrial(facts({
      endedAt: new Date("2026-10-01T00:00:00Z"), outcome: "expired",
      usage: [use("pms", 11, 4)], lastSeenDaysAgo: 1, now: new Date("2026-10-02T00:00:00Z"),
    }));
    expect(r.verdict).toBe("ended_engaged");
    expect(r.action).toMatch(/stopped only because the clock did/);
  });

  it("an expired trial nobody opened is an onboarding question, not a price one", () => {
    const r = readTrial(facts({
      endedAt: new Date("2026-10-01T00:00:00Z"), outcome: "expired",
      usage: [], now: new Date("2026-10-02T00:00:00Z"),
    }));
    expect(r.verdict).toBe("ended_cold");
    expect(r.action).toMatch(/not a price one/);
  });

  it("says nothing at all once they have bought it", () => {
    const r = readTrial(facts({ endedAt: new Date(), outcome: "converted", usage: [use("cm", 10, 3)] }));
    expect(r.verdict).toBe("converted");
    expect(r.action).toBeNull();
  });

  it("reports what they never opened, without calling it a failure", () => {
    const r = readTrial(facts({ usage: [use("cm", 6, 2)], lastSeenDaysAgo: 0 }));
    expect(r.untouched.map((p) => p.key).sort()).toEqual(["crs", "pms"]);
  });

  it("counts days left and progress through the period", () => {
    const r = readTrial(facts({ now: new Date("2026-09-16T00:00:00Z"), usage: [use("cm", 4)], lastSeenDaysAgo: 0 }));
    expect(r.daysElapsed).toBe(15);
    expect(r.daysLeft).toBe(15);
    expect(r.progress).toBeCloseTo(0.5, 1);
  });
});

describe("trialsByUrgency", () => {
  it("puts what needs doing today first, then whatever runs out soonest", () => {
    const mk = (urgency: "now" | "soon" | "none", daysLeft: number) =>
      ({ reading: { urgency, daysLeft } } as Parameters<typeof trialsByUrgency>[0][number]);
    const sorted = trialsByUrgency([mk("none", 1), mk("soon", 20), mk("now", 9), mk("now", 2)]);
    expect(sorted.map((r) => [r.reading.urgency, r.reading.daysLeft])).toEqual([
      ["now", 2], ["now", 9], ["soon", 20], ["none", 1],
    ]);
  });
});

describe("finished", () => {
  it("⚠️ a trial ended EARLY is finished, even though its end date is still ahead", () => {
    // Converted or cancelled before the clock ran out. Reading `daysLeft` alone put "ended · was
    // used" beside "11 days left" on the same row — found by looking at the screen, not by a test.
    const r = readTrial(facts({
      endedAt: new Date("2026-09-18T00:00:00Z"), outcome: "expired",
      usage: [use("cm", 9, 2)], lastSeenDaysAgo: 2, now: new Date("2026-09-20T00:00:00Z"),
    }));
    expect(r.daysLeft).toBeGreaterThan(0);
    expect(r.finished).toBe(true);
  });

  it("a running trial is not finished", () => {
    expect(readTrial(facts({ usage: [use("cm", 4)], lastSeenDaysAgo: 0 })).finished).toBe(false);
  });

  it("a trial past its end date is finished even with no outcome written yet", () => {
    // The sweep runs on a schedule, so there is always a window where the clock has passed and the
    // row has not been updated. The screen must not keep counting down into negatives.
    const r = readTrial(facts({ now: new Date("2026-10-05T00:00:00Z"), usage: [use("cm", 6, 2)], lastSeenDaysAgo: 1 }));
    expect(r.finished).toBe(true);
  });
});
