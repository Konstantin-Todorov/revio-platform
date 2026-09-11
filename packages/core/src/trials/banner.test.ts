import { describe, it, expect } from "vitest";
import { trialBanner, trialDaysLeft, type TrialBannerFacts } from "./banner.js";
import { TRIAL_REMINDER_DAYS } from "./trials.js";

/**
 * What the hotel reads at the top of a product they have not paid for.
 *
 * Every assertion here is a promise the platform makes elsewhere — in the trial email, in
 * `selfTrialPromises`, in the pricing model — and this is the one place the customer actually reads
 * it. Copy that drifts from those promises is worse than no banner.
 */

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const at = (iso: string) => new Date(iso);

const BASE: TrialBannerFacts = {
  product: "pms",
  startedAt: at("2026-09-01T09:00:00Z"),
  endsAt: at("2026-10-01T09:00:00Z"),
  keepRequested: false,
};

describe("how much time is left", () => {
  it("counts whole days remaining", () => {
    expect(trialBanner(BASE, at("2026-09-08T09:00:00Z"), fmt).daysLeft).toBe(23);
  });

  it("rounds a part-day UP, so hours left never reads as zero days", () => {
    // "0 days left" on a trial that still works all afternoon is a lie in the alarming direction.
    expect(trialDaysLeft(at("2026-10-01T09:00:00Z"), at("2026-09-30T20:00:00Z"))).toBe(1);
  });

  it("never goes negative once it has run out", () => {
    expect(trialDaysLeft(at("2026-10-01T09:00:00Z"), at("2026-10-09T09:00:00Z"))).toBe(0);
  });
});

describe("how loud it is", () => {
  it("stays calm for most of the month", () => {
    expect(trialBanner(BASE, at("2026-09-08T09:00:00Z"), fmt).tone).toBe("calm");
  });

  /*
   * THE one that must not drift. The strip and the reminder emails have to agree about when this
   * becomes urgent — a banner that turns amber on a different day from the email gives the hotel
   * two accounts of how soon this matters.
   */
  it("changes tone on exactly the days the reminder emails are sent", () => {
    const [warnAt, urgentAt] = TRIAL_REMINDER_DAYS;
    const dayOf = (left: number) => at(new Date(BASE.endsAt.getTime() - left * 86_400_000).toISOString());
    expect(trialBanner(BASE, dayOf(warnAt + 1), fmt).tone).toBe("calm");
    expect(trialBanner(BASE, dayOf(warnAt), fmt).tone).toBe("warning");
    expect(trialBanner(BASE, dayOf(urgentAt), fmt).tone).toBe("urgent");
  });

  it("names the last day as the last day, not as a number", () => {
    const h = trialBanner(BASE, at("2026-09-30T09:00:00Z"), fmt).headline;
    expect(h).toMatch(/Last day/);
    expect(h).toContain("RevioPMS");
  });

  it("says today when it is today", () => {
    expect(trialBanner(BASE, at("2026-10-01T09:00:00Z"), fmt).headline).toMatch(/ends today/);
  });
});

describe("what it promises", () => {
  it("says nothing is charged and nothing renews", () => {
    // The platform's whole claim: a trial never becomes a bill on its own. This is where a customer
    // reads it, so it is asserted rather than trusted to copy review.
    const b = trialBanner(BASE, at("2026-09-08T09:00:00Z"), fmt);
    expect(b.detail).toMatch(/[Nn]othing is charged/);
    expect(b.detail).toMatch(/nothing renews on its own/);
  });

  it("promises no data is deleted, and names the date it switches off", () => {
    const b = trialBanner(BASE, at("2026-09-08T09:00:00Z"), fmt);
    expect(b.detail).toMatch(/none of your data is deleted/);
    expect(b.detail).toContain("2026-10-01");
  });

  it("never hints that a subscription begins", () => {
    for (const day of ["2026-09-02", "2026-09-25", "2026-09-30", "2026-10-01"]) {
      const b = trialBanner(BASE, at(`${day}T09:00:00Z`), fmt);
      const all = `${b.headline} ${b.detail} ${b.cta ?? ""}`;
      expect(all, day).not.toMatch(/subscription|billed|auto-renew|your plan starts/i);
    }
  });
});

describe("once they have asked to keep it", () => {
  const asked = { ...BASE, keepRequested: true };

  it("stops asking", () => {
    // A banner that keeps selling after the customer said yes is how people learn to ignore banners.
    expect(trialBanner(asked, at("2026-09-08T09:00:00Z"), fmt).cta).toBeNull();
    expect(trialBanner(BASE, at("2026-09-08T09:00:00Z"), fmt).cta).toBe("Keep RevioPMS");
  });

  it("confirms we heard them, and that nothing stops while we sort it out", () => {
    const b = trialBanner(asked, at("2026-09-08T09:00:00Z"), fmt);
    expect(b.detail).toMatch(/asked to keep/i);
    expect(b.detail).toMatch(/nothing stops in the meantime/i);
  });

  it("still counts down — asking does not pause the clock", () => {
    // It genuinely does not: the entitlement still expires on the same date until an operator acts.
    expect(trialBanner(asked, at("2026-09-30T09:00:00Z"), fmt).tone).toBe("urgent");
  });
});

describe("the progress rule", () => {
  it("is 0 at the start, half way at half way, and 1 at the end", () => {
    expect(trialBanner(BASE, BASE.startedAt, fmt).elapsed).toBe(0);
    expect(trialBanner(BASE, at("2026-09-16T09:00:00Z"), fmt).elapsed).toBeCloseTo(0.5, 2);
    expect(trialBanner(BASE, BASE.endsAt, fmt).elapsed).toBe(1);
  });

  it("clamps, so a clock skew cannot draw a bar past its own track", () => {
    expect(trialBanner(BASE, at("2026-08-01T09:00:00Z"), fmt).elapsed).toBe(0);
    expect(trialBanner(BASE, at("2026-12-01T09:00:00Z"), fmt).elapsed).toBe(1);
  });
});
