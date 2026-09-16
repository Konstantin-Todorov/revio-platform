import { describe, it, expect } from "vitest";
import { canStillClaim, daysUntil, trialClock, trialEndFor } from "./clock.js";
// ⚠️ From `trials.ts` — there is exactly one TRIAL_DAYS, and the clock imports it rather than
// declaring a second thirty beside the first.
import { TRIAL_DAYS } from "./trials.js";

const at = (iso: string) => new Date(iso);
const DAY = 86_400_000;
const signup = at("2026-09-01T10:00:00Z");

describe("trialClock", () => {
  it("⚠️ an unopened product is an INVITATION, not a countdown", () => {
    /*
     * The failure this rule exists to remove: three clocks started at signup, so a hotel that spent
     * its first fortnight in RevioLink opened RevioCRS with fifteen days left. We advertised three
     * trials and delivered one. An unopened product has not started and must not be counting down.
     */
    const c = trialClock({ accountCreatedAt: signup, openedAt: null }, at("2026-09-15T10:00:00Z"));
    expect(c.state).toBe("unopened");
    expect(c.state === "unopened" && c.claimDaysLeft).toBe(16);
  });

  it("gives a full 30 days from the day it is opened, however late that is", () => {
    const openedOnDay20 = at("2026-09-21T10:00:00Z");
    const c = trialClock({ accountCreatedAt: signup, openedAt: openedOnDay20 }, openedOnDay20);
    expect(c.state).toBe("running");
    expect(c.state === "running" && c.daysLeft).toBe(TRIAL_DAYS);
    expect(c.state === "running" && c.endsAt).toEqual(at("2026-10-21T10:00:00Z"));
  });

  it("⚠️ is BOUNDED — the offer lapses even though the clock never started", () => {
    // Without this, opening RevioPMS a year later begins a fresh month. Thirty days to take it up,
    // thirty days to use it: sixty from signup at worst, which is a number we can plan around.
    const c = trialClock({ accountCreatedAt: signup, openedAt: null }, at("2026-10-05T10:00:00Z"));
    expect(c.state).toBe("lapsed");
    expect(canStillClaim({ accountCreatedAt: signup, openedAt: null }, at("2026-10-05T10:00:00Z"))).toBe(false);
  });

  it("the claim window is still open on its last day, and shut the day after", () => {
    const lastDay = new Date(signup.getTime() + 30 * DAY - 1000);
    expect(canStillClaim({ accountCreatedAt: signup, openedAt: null }, lastDay)).toBe(true);
    const justAfter = new Date(signup.getTime() + 30 * DAY + 1000);
    expect(canStillClaim({ accountCreatedAt: signup, openedAt: null }, justAfter)).toBe(false);
  });

  it("ends when it ends", () => {
    const opened = at("2026-09-01T10:00:00Z");
    const c = trialClock({ accountCreatedAt: signup, openedAt: opened }, at("2026-10-02T10:00:00Z"));
    expect(c.state).toBe("ended");
  });

  it("⚠️ an hour left is ONE day left, never zero", () => {
    // A trial that says "0 days left" while it is still running reads as already over, and the
    // hotel stops using the thing they are still entitled to use.
    const opened = at("2026-09-01T10:00:00Z");
    const c = trialClock({ accountCreatedAt: signup, openedAt: opened }, at("2026-10-01T09:00:00Z"));
    expect(c.state === "running" && c.daysLeft).toBe(1);
  });

  it("⚠️ opening all three on day one still ends them all on day 30", () => {
    // The rule must not accidentally reward doing the sensible thing with LESS time. A hotel that
    // opens everything at once is the common case and gets exactly what was advertised.
    const day1 = signup;
    for (const _ of ["cm", "crs", "pms"]) {
      const c = trialClock({ accountCreatedAt: signup, openedAt: day1 }, day1);
      expect(c.state === "running" && c.endsAt).toEqual(trialEndFor(day1));
    }
  });

  it("⚠️ the end date is DERIVED, so a banner and an email cannot disagree", () => {
    // Two places computing the end of a trial is how a countdown and a reminder come to name
    // different dates, and the hotel believes whichever they read last.
    const opened = at("2026-09-10T08:30:00Z");
    const c = trialClock({ accountCreatedAt: signup, openedAt: opened }, opened);
    expect(c.state === "running" && c.endsAt).toEqual(trialEndFor(opened));
  });
});

describe("daysUntil", () => {
  it("rounds up, so a partial day is still a day", () => {
    expect(daysUntil(at("2026-09-02T00:00:00Z"), at("2026-09-01T23:00:00Z"))).toBe(1);
    expect(daysUntil(at("2026-09-03T00:00:00Z"), at("2026-09-01T23:00:00Z"))).toBe(2);
  });

  it("⚠️ never returns negative zero, which prints as \"-0\"", () => {
    // `Math.ceil(-0.04)` is -0 in JavaScript. A banner reading "-0 days left" is exactly the kind of
    // detail that tells a hotel nobody checked the software running their bookings.
    const justPast = daysUntil(at("2026-09-01T23:00:00Z"), at("2026-09-02T00:00:00Z"));
    expect(Object.is(justPast, -0)).toBe(false);
    expect(justPast).toBe(0);
  });
});
