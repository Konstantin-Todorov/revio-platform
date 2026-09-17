import { describe, expect, it } from "vitest";
import { decideAlerts, operatorAlertEmail, NAG_DAYS, type AlertCandidate, type AlertRecord } from "./operator-alert";

const NOW = new Date("2026-09-17T20:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const c = (over: Partial<AlertCandidate> = {}): AlertCandidate => ({
  key: "cross_wired:ch1:2BR-Standard",
  clientName: "DesManagement 2015",
  summary: "A rate plan is publishing to the wrong room",
  action: "Open Mapping and re-pick the plan",
  severity: "act",
  ...over,
});
const known = (over: Partial<AlertRecord> = {}): AlertRecord => ({
  key: c().key, firstSeenAt: daysAgo(1), lastAlertedAt: daysAgo(1), ...over,
});

describe("what it stays silent about", () => {
  /*
   * ⚠️ The hard part. A digest that arrives hourly saying "nothing to report" is one people filter
   * to a folder — and then the one that matters is filtered too.
   */
  it("says nothing when there is nothing", () => {
    expect(decideAlerts([], [], NOW).silent).toBe(true);
  });

  it("says nothing about a fault it has already reported", () => {
    const d = decideAlerts([c()], [known()], NOW);
    expect(d.silent).toBe(true);
    expect(d.fresh).toEqual([]);
  });

  it("repeats itself for a hundred runs, not just the second one", () => {
    // The job runs hourly. Reporting again on run 2 would be 24 mails a day for one fault.
    const k = known({ lastAlertedAt: daysAgo(NAG_DAYS - 0.5) });
    expect(decideAlerts([c()], [k], NOW).silent).toBe(true);
  });
});

describe("what it does say", () => {
  it("reports a fault it has never seen", () => {
    const d = decideAlerts([c()], [], NOW);
    expect(d.fresh).toHaveLength(1);
    expect(d.silent).toBe(false);
  });

  /*
   * "We told you once, three weeks ago" is how something stays broken. A fault nobody fixed comes
   * back, carrying its age.
   */
  it("raises an unfixed fault again after the nag window, with how long it has been open", () => {
    const k = known({ firstSeenAt: daysAgo(9), lastAlertedAt: daysAgo(NAG_DAYS + 1) });
    const d = decideAlerts([c()], [k], NOW);
    expect(d.fresh).toEqual([]);
    expect(d.stale[0]?.openDays).toBe(9);
  });

  it("puts what to act on first", () => {
    const d = decideAlerts([c({ key: "a", severity: "soon" }), c({ key: "b", severity: "act" })], [], NOW);
    expect(d.fresh.map((f) => f.key)).toEqual(["b", "a"]);
  });
});

describe("the mail", () => {
  /*
   * ⚠️ The subject is the only part read on a phone at the wrong moment. "3 things need attention"
   * is a subject somebody opens later.
   */
  it("names the client and the worst thing in the subject", () => {
    const m = operatorAlertEmail(decideAlerts([c()], [], NOW), "https://operator.reviosoft.app");
    expect(m.subject).toBe("DesManagement 2015 — A rate plan is publishing to the wrong room");
  });

  it("says how many others when there are others", () => {
    const d = decideAlerts([c({ key: "a" }), c({ key: "b" })], [], NOW);
    expect(operatorAlertEmail(d, "x").subject).toMatch(/\(and 1 more\)$/);
  });

  it("carries the action for each fault, not just the fault", () => {
    const m = operatorAlertEmail(decideAlerts([c()], [], NOW), "x");
    expect(m.text).toMatch(/Open Mapping and re-pick the plan/);
  });

  /* So an empty inbox reads as "nothing wrong" rather than "the alerting broke". */
  it("states the rule, so silence can be trusted", () => {
    const m = operatorAlertEmail(decideAlerts([c()], [], NOW), "x");
    expect(m.text).toMatch(/No mail means nothing needs doing/);
  });

  it("distinguishes a reminder from news", () => {
    const k = known({ firstSeenAt: daysAgo(5), lastAlertedAt: daysAgo(NAG_DAYS + 1) });
    const m = operatorAlertEmail(decideAlerts([c()], [k], NOW), "x");
    expect(m.text).toMatch(/still open/i);
    expect(m.text).toMatch(/open 5 days/);
  });
});
