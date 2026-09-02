import { describe, it, expect } from "vitest";
import {
  syncRecencyHealth, pendingSubtitle, failureVerdict, successRate, pushedOf, describeAge,
  SYNC_FRESH_MS, SYNC_STALE_MS,
} from "./sync-health.js";

const NOW = new Date("2026-09-02T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const H = 60 * 60 * 1000;
const D = 24 * H;

describe("syncRecencyHealth — connection state is not delivery health", () => {
  it("is healthy for a sync within the last day", () => {
    expect(syncRecencyHealth(ago(2 * H), NOW).health).toBe("healthy");
  });

  it("is NOT healthy at 29 days — the exact case that shipped a green 'Live' pill", () => {
    const v = syncRecencyHealth(ago(29 * D), NOW);
    expect(v.health).toBe("dead");
    expect(v.label).not.toBe("Live");
  });

  it("is stale between one day and one week", () => {
    expect(syncRecencyHealth(ago(3 * D), NOW).health).toBe("stale");
  });

  it("is dead past a week", () => {
    expect(syncRecencyHealth(ago(8 * D), NOW).health).toBe("dead");
    expect(syncRecencyHealth(ago(65 * D), NOW).health).toBe("dead");
  });

  it("distinguishes NEVER SYNCED from unhealthy — it is not a fault, and not health either", () => {
    const v = syncRecencyHealth(null, NOW);
    expect(v.health).toBe("idle");
    expect(v.label).toBe("Never synced");
  });

  it("treats the boundaries as inclusive of the better state", () => {
    expect(syncRecencyHealth(ago(SYNC_FRESH_MS), NOW).health).toBe("healthy");
    expect(syncRecencyHealth(ago(SYNC_FRESH_MS + 1), NOW).health).toBe("stale");
    expect(syncRecencyHealth(ago(SYNC_STALE_MS), NOW).health).toBe("stale");
    expect(syncRecencyHealth(ago(SYNC_STALE_MS + 1), NOW).health).toBe("dead");
  });

  it("does not paint a working channel red because of clock skew", () => {
    // A timestamp in the future is a clock problem, not staleness.
    expect(syncRecencyHealth(new Date(NOW.getTime() + H), NOW).health).toBe("healthy");
  });
});

describe("pendingSubtitle — derived from the number, never static copy", () => {
  it("says the queue is empty only when it IS empty", () => {
    expect(pendingSubtitle(0, null, NOW)).toContain("Queue empty");
  });

  it("never says 'Queue empty' above a non-zero count — the shipped contradiction", () => {
    const s = pendingSubtitle(10, null, NOW);
    expect(s).not.toContain("Queue empty");
    expect(s).toContain("10 updates");
  });

  it("carries the age of the oldest item — ten for 30s is normal, ten for 2 days is an incident", () => {
    expect(pendingSubtitle(10, ago(3 * H), NOW)).toContain("3h ago");
    expect(pendingSubtitle(10, ago(2 * D), NOW)).toContain("2 days ago");
  });

  it("says 'update' for one", () => {
    expect(pendingSubtitle(1, null, NOW)).toContain("1 update waiting");
  });

  it("treats a negative count as empty rather than printing it", () => {
    expect(pendingSubtitle(-3, null, NOW)).toContain("Queue empty");
  });
});

describe("failureVerdict — a zero from silence is not a zero from success", () => {
  it("does NOT report Clear when nothing was attempted", () => {
    const v = failureVerdict(0, 0);
    expect(v.health).toBe("unknown");
    expect(v.label).not.toBe("Clear");
    expect(v.detail).toContain("No syncs were attempted");
  });

  it("reports Clear only when attempts actually succeeded", () => {
    const v = failureVerdict(40, 0);
    expect(v.health).toBe("healthy");
    expect(v.label).toBe("Clear");
  });

  it("reports failures with their denominator", () => {
    expect(failureVerdict(40, 3).detail).toContain("3 of 40");
  });
});

describe("successRate — 100% beside open errors is nonsense", () => {
  it("is null, not 100%, when nothing was attempted", () => {
    // A rate over zero attempts is undefined. Rendering it as 100% is how silence became green.
    expect(successRate(0, 0, 0).pct).toBeNull();
  });

  it("qualifies a 100% that sits beside unresolved errors", () => {
    const r = successRate(50, 0, 25);
    expect(r.pct).toBe(100);
    expect(r.qualified).toBe(true);
    expect(r.detail).toContain("25 errors are still open");
  });

  it("does not qualify a clean 100% with no open errors", () => {
    expect(successRate(50, 0, 0).qualified).toBe(false);
  });

  it("computes an ordinary rate", () => {
    expect(successRate(10, 2, 0).pct).toBe(80);
  });

  it("never returns a negative rate when failures exceed attempts", () => {
    expect(successRate(5, 99, 0).pct).toBe(0);
  });
});

describe("pushedOf — a count of things that happened cannot be negative", () => {
  it("reproduces the shipped bug's inputs and refuses to print a negative", () => {
    // `Pushed -56/56` came from sent - rejected where rejected exceeded sent.
    expect(pushedOf(56, 112).text).toBe("0/56");
  });

  it("is the ordinary difference when the numbers are sane", () => {
    expect(pushedOf(365, 2).text).toBe("363/365");
  });

  it("never exceeds the total", () => {
    expect(pushedOf(10, -5).sent).toBe(10);
  });

  it("handles a nonsense total without producing a nonsense string", () => {
    expect(pushedOf(-3, 0).text).toBe("0/0");
  });
});

describe("describeAge", () => {
  it("reads naturally at each scale", () => {
    expect(describeAge(30 * 1000)).toBe("just now");
    expect(describeAge(45 * 60 * 1000)).toBe("45 min ago");
    expect(describeAge(3 * H)).toBe("3h ago");
    expect(describeAge(D)).toBe("1 day ago");
    expect(describeAge(9 * D)).toBe("9 days ago");
  });
});
