import { describe, expect, it } from "vitest";
import { failureVerdict, pendingSubtitle, reviolinkSetup, syncRecencyHealth } from "@revio/core";
import { dashboard } from "./dashboard";

/**
 * Sentences core writes in English, worded again in RevioLink so they can be Bulgarian. The Operator
 * console still reads core's, so the English must stay word for word the same.
 */
describe("RevioLink dashboard English matches core", () => {
  const en = dashboard.en;
  const now = new Date("2026-09-26T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("sync recency, every state", () => {
    for (const at of [null, ago(60_000), ago(2 * 86_400_000), ago(9 * 86_400_000)]) {
      const v = syncRecencyHealth(at, now);
      expect({ label: v.label, detail: v.detail ?? "" }).toEqual(en.recency[v.health as keyof typeof en.recency]);
    }
  });

  it("failure verdict, every state", () => {
    expect(en.failure.unknown).toEqual({ label: failureVerdict(0, 0).label, detail: failureVerdict(0, 0).detail });
    expect(en.failure.dead.detail(2, 9)).toBe(failureVerdict(9, 2).detail);
    expect(en.failure.dead.label).toBe(failureVerdict(9, 2).label);
    expect(en.failure.healthy.detail(9)).toBe(failureVerdict(9, 0).detail);
    expect(en.failure.healthy.label).toBe(failureVerdict(9, 0).label);
  });

  it("pending subtitle and the ages it prints", () => {
    expect(en.pendingSub.empty).toBe(pendingSubtitle(0, null, now));
    expect(en.pendingSub.waiting(1)).toBe(pendingSubtitle(1, null, now));
    expect(en.pendingSub.waiting(3)).toBe(pendingSubtitle(3, null, now));
    const cases: [number, string][] = [[10_000, en.age.justNow], [5 * 60_000, en.age.min(5)], [3 * 3_600_000, en.age.hours(3)], [86_400_000, en.age.oneDay], [4 * 86_400_000, en.age.days(4)]];
    for (const [ms, age] of cases) expect(en.pendingSub.waitingOldest(2, age)).toBe(pendingSubtitle(2, ago(ms), now));
  });

  it("every setup step", () => {
    const facts = { roomTypes: 0, hasRates: false, channels: 0, mappingComplete: false, alsoRuns: [] } as unknown as Parameters<typeof reviolinkSetup>[0];
    for (const st of reviolinkSetup(facts).steps) {
      expect({ key: st.key, ...en.setupSteps[st.key] }).toEqual({ key: st.key, title: st.title, body: st.body, cta: st.cta });
    }
  });
});
