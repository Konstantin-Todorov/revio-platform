import { describe, expect, it } from "vitest";
import {
  accountAttention,
  buildTimeline,
  lastContactAt,
  observedStage,
  renewalStatus,
  rollRenewal,
  type AccountSignals,
  type StageSignals,
  type TimelineItem,
} from "./account.js";

const NOW = new Date("2026-08-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const stage = (o: Partial<StageSignals> = {}): StageSignals => ({
  status: "active",
  createdAt: daysAgo(365),
  properties: 1,
  roomTypes: 6,
  lastReservationAt: daysAgo(2),
  ...o,
});

describe("observedStage", () => {
  it("is live while bookings keep arriving", () => {
    expect(observedStage(stage(), NOW)).toBe("live");
  });

  it("is onboarding while there is nothing to sell", () => {
    expect(observedStage(stage({ createdAt: daysAgo(5), properties: 0, lastReservationAt: null }), NOW)).toBe("onboarding");
    expect(observedStage(stage({ createdAt: daysAgo(5), roomTypes: 0, lastReservationAt: null }), NOW)).toBe("onboarding");
  });

  it("stops calling it onboarding once set-up has dragged for two months", () => {
    // "Onboarding" for a hotel that bought in June and still has no rooms in August is a euphemism.
    expect(observedStage(stage({ createdAt: daysAgo(90), roomTypes: 0, lastReservationAt: null }), NOW)).toBe("at_risk");
  });

  it("is at risk after a month of silence, churned after three", () => {
    expect(observedStage(stage({ lastReservationAt: daysAgo(45) }), NOW)).toBe("at_risk");
    expect(observedStage(stage({ lastReservationAt: daysAgo(120) }), NOW)).toBe("churned");
  });

  it("never reports a suspended client as live, whatever last month's bookings say", () => {
    // The bookings happened before we turned the key.
    expect(observedStage(stage({ status: "suspended" }), NOW)).toBe("at_risk");
  });

  it("leaves a long-dead suspended client churned rather than promoting it to at risk", () => {
    expect(observedStage(stage({ status: "suspended", lastReservationAt: daysAgo(200) }), NOW)).toBe("churned");
  });

  it("never invents a prospect — that is a fact about a conversation, not about data", () => {
    const everyShape: StageSignals[] = [
      stage(), stage({ properties: 0 }), stage({ lastReservationAt: null }),
      stage({ lastReservationAt: daysAgo(200) }), stage({ status: "suspended" }),
    ];
    for (const s of everyShape) expect(observedStage(s, NOW)).not.toBe("prospect");
  });
});

describe("renewalStatus", () => {
  it("is nobody's problem when it is far away", () => {
    expect(renewalStatus(daysAhead(120), NOW)).toBeNull();
    expect(renewalStatus(null, NOW)).toBeNull();
  });

  it("escalates as the date approaches", () => {
    expect(renewalStatus(daysAhead(50), NOW)!.severity).toBe("soon");
    expect(renewalStatus(daysAhead(20), NOW)!.severity).toBe("act");
    expect(renewalStatus(daysAhead(0), NOW)!.label).toBe("Renews today");
  });

  it("keeps shouting after the date has passed", () => {
    // A missed renewal does not stop being a problem by going quiet.
    const r = renewalStatus(daysAgo(9), NOW)!;
    expect(r.severity).toBe("act");
    expect(r.days).toBeLessThan(0);
    expect(r.label).toContain("passed");
  });
});

describe("rollRenewal", () => {
  it("advances by the contract term", () => {
    expect(rollRenewal(new Date("2026-09-01T00:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-09-01");
    expect(rollRenewal(new Date("2026-09-01T00:00:00Z"), 6).toISOString().slice(0, 10)).toBe("2027-03-01");
  });

  it("anchors on the old date, not today, so a late renewal keeps its anniversary", () => {
    // Renewed three weeks late in August; the next one is still due on the January date.
    expect(rollRenewal(new Date("2026-01-15T00:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("clamps the day of month instead of rolling into the next one", () => {
    // 31 Jan + 1 month is 28 Feb. Naive date arithmetic gives 3 March, which is a renewal date nobody
    // agreed to and, worse, one that drifts a little further every year.
    expect(rollRenewal(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(rollRenewal(new Date("2028-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29"); // leap year
  });

  it("treats a missing or nonsense term as annual", () => {
    expect(rollRenewal(new Date("2026-09-01T00:00:00Z"), 0).toISOString().slice(0, 10)).toBe("2027-09-01");
  });
});

describe("lastContactAt", () => {
  it("counts calls, emails and meetings", () => {
    const at = lastContactAt([
      { kind: "call", occurredAt: daysAgo(30) },
      { kind: "meeting", occurredAt: daysAgo(10) },
      { kind: "email", occurredAt: daysAgo(50) },
    ]);
    expect(at).toEqual(daysAgo(10));
  });

  it("does NOT count writing something down about them", () => {
    // Otherwise a console reports a warm relationship with a customer nobody has spoken to since March.
    expect(lastContactAt([{ kind: "note", occurredAt: daysAgo(1) }, { kind: "issue", occurredAt: daysAgo(2) }])).toBeNull();
  });

  it("is null when there is nothing logged", () => {
    expect(lastContactAt([])).toBeNull();
  });
});

const account = (o: Partial<AccountSignals> = {}): AccountSignals => ({
  status: "active",
  createdAt: daysAgo(365),
  stage: "live",
  observed: "live",
  renewalDate: null,
  lastContactAt: daysAgo(7),
  hasPrimaryContact: true,
  monthlyPriceMinor: 19_900,
  ...o,
});

describe("accountAttention", () => {
  it("says nothing about a healthy, recently-spoken-to client", () => {
    // The test that matters most: a console that always has something to say gets ignored.
    expect(accountAttention(account(), NOW)).toEqual([]);
  });

  it("says nothing at all about a suspended client", () => {
    // clientAttention already reports the suspension. Renewal chatter under a locked account is the
    // same mistake as telling someone their car won't start while it is up on the ramp.
    const flags = accountAttention(
      account({ status: "suspended", renewalDate: daysAhead(3), lastContactAt: daysAgo(400), hasPrimaryContact: false }),
      NOW,
    );
    expect(flags).toEqual([]);
  });

  it("raises the renewal as it approaches", () => {
    expect(accountAttention(account({ renewalDate: daysAhead(20) }), NOW)[0]!.severity).toBe("act");
    expect(accountAttention(account({ renewalDate: daysAhead(45) }), NOW)[0]!.severity).toBe("soon");
    expect(accountAttention(account({ renewalDate: daysAhead(200) }), NOW)).toEqual([]);
  });

  it("does not chase a renewal for a client already written off", () => {
    const flags = accountAttention(
      account({ stage: "churned", observed: "churned", renewalDate: daysAhead(10), monthlyPriceMinor: 0 }),
      NOW,
    );
    expect(flags).toEqual([]);
  });

  it("reports the belief disagreeing with the behaviour, in both directions", () => {
    const bad = accountAttention(account({ stage: "live", observed: "churned" }), NOW);
    expect(bad[0]!.severity).toBe("act");
    expect(bad[0]!.title).toContain("Marked live");

    const good = accountAttention(account({ stage: "at_risk", observed: "live" }), NOW);
    expect(good[0]!.severity).toBe("note"); // good news, not an emergency
    expect(good[0]!.title).toContain("behaving live");
  });

  it("catches a live hotel that is being billed nothing", () => {
    // The most embarrassing kind of revenue leak: still marked a prospect, running in production.
    const flags = accountAttention(account({ stage: "prospect", observed: "live", monthlyPriceMinor: 0 }), NOW);
    expect(flags[0]!.severity).toBe("act");
    expect(flags[0]!.title).toBe("Marked prospect but live");
  });

  it("flags an account with nobody to call", () => {
    const flags = accountAttention(account({ hasPrimaryContact: false }), NOW);
    expect(flags.map((f) => f.title)).toContain("No one to call");
  });

  it("stays quiet about contacts during the grace period", () => {
    expect(accountAttention(account({ createdAt: daysAgo(3), hasPrimaryContact: false, lastContactAt: null }), NOW)).toEqual([]);
  });

  it("flags a paying customer nobody has spoken to in three months", () => {
    const flags = accountAttention(account({ lastContactAt: daysAgo(120) }), NOW);
    expect(flags[0]!.title).toBe("No contact in 120 days");
    expect(flags[0]!.severity).toBe("soon");
  });

  it("flags a paying customer never contacted at all", () => {
    const flags = accountAttention(account({ lastContactAt: null }), NOW);
    expect(flags[0]!.title).toBe("Never contacted");
  });

  it("does not chase contact for a client paying nothing", () => {
    // A free pilot going quiet is not the same problem, and mixing them dilutes the one that costs money.
    expect(accountAttention(account({ monthlyPriceMinor: 0, lastContactAt: daysAgo(400) }), NOW)).toEqual([]);
  });
});

describe("buildTimeline", () => {
  const item = (id: string, at: Date, kind = "note"): TimelineItem => ({ id, at, kind, title: id });

  it("is newest first", () => {
    const out = buildTimeline([item("a", daysAgo(10)), item("c", daysAgo(1)), item("b", daysAgo(5))], NOW);
    expect(out.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("EXCLUDES future entries rather than sorting them in", () => {
    // The renewal date is a real event with a real date. Dropped into a list headed "what happened",
    // next March sits above last week's call and the log stops being a log.
    const out = buildTimeline([item("past", daysAgo(1)), item("renewal", daysAhead(200))], NOW);
    expect(out.map((i) => i.id)).toEqual(["past"]);
  });

  it("keeps a stable order for entries at the same instant", () => {
    const same = new Date("2026-08-01T09:00:00Z");
    const out = buildTimeline([item("z", same), item("a", same)], NOW);
    expect(out.map((i) => i.id)).toEqual(["a", "z"]);
  });
});
