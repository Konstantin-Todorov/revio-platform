import { describe, it, expect } from "vitest";
import { productAccessCopy, productAccessState, type TrialHistory } from "./product-access.js";

const ALL_OFF = { cm: false, crs: false, pms: false };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const ENDED = new Date("2026-09-01T00:00:00Z");

const expired = (product: TrialHistory["product"], over: Partial<TrialHistory> = {}): TrialHistory => ({
  product, endedAt: ENDED, outcome: "expired", keepRequestedAt: null, ...over,
});

describe("productAccessState", () => {
  it("⚠️ tells a hotel whose trial ENDED apart from one that never had the product", () => {
    // The screen this replaces said "hasn't subscribed" to both — false for the first, and the last
    // thing we say to somebody who just spent a month evaluating us.
    const ran = productAccessState({ product: "cm", trials: [expired("cm")], entitlements: ALL_OFF });
    const never = productAccessState({ product: "cm", trials: [], entitlements: ALL_OFF });
    expect(ran.reason).toBe("trial-ended");
    expect(never.reason).toBe("never-had");
  });

  it("a trial WE cancelled is a different conversation from one that ran its course", () => {
    const s = productAccessState({
      product: "cm", trials: [expired("cm", { outcome: "cancelled" })], entitlements: ALL_OFF,
    });
    expect(s.reason).toBe("switched-off");
  });

  it("⚠️ never offers a second trial of a product already trialled", () => {
    // `canSelfStartTrial` allows one per product EVER. Offering one here would be a promise the
    // writer refuses a click later.
    const s = productAccessState({ product: "cm", trials: [expired("cm")], entitlements: ALL_OFF });
    expect(s.canStartTrial).toBe(false);
  });

  it("offers a trial only when this product has never been tried", () => {
    const s = productAccessState({ product: "pms", trials: [expired("cm")], entitlements: ALL_OFF });
    expect(s.reason).toBe("never-had");
    expect(s.canStartTrial).toBe(true);
  });

  it("⚠️ always carries the doors that DO open", () => {
    // A trial ends per product, so a hotel that lost RevioLink may still be in RevioCRS every
    // morning. A wall with no doors is how somebody decides the whole platform is broken.
    const s = productAccessState({
      product: "cm", trials: [expired("cm")], entitlements: { cm: false, crs: true, pms: true },
    });
    expect(s.stillOpen.map((p) => p.key)).toEqual(["crs", "pms"]);
  });

  it("never lists the product they are locked out of among the ones that work", () => {
    const s = productAccessState({
      product: "crs", trials: [], entitlements: { cm: true, crs: true, pms: false },
    });
    expect(s.stillOpen.map((p) => p.key)).toEqual(["cm"]);
  });

  it("remembers that they already asked to keep it", () => {
    const s = productAccessState({
      product: "cm", trials: [expired("cm", { keepRequestedAt: new Date() })], entitlements: ALL_OFF,
    });
    expect(s.keepRequested).toBe(true);
  });

  it("takes the most recent ending when there is more than one row", () => {
    const older = expired("cm", { endedAt: new Date("2026-01-01T00:00:00Z") });
    const s = productAccessState({ product: "cm", trials: [older, expired("cm")], entitlements: ALL_OFF });
    expect(s.endedAt?.toISOString()).toBe(ENDED.toISOString());
  });
});

describe("productAccessCopy", () => {
  it("⚠️ says nothing was deleted — the fear that stops somebody coming back", () => {
    const s = productAccessState({ product: "cm", trials: [expired("cm")], entitlements: ALL_OFF });
    const c = productAccessCopy(s, "Hotel Cabacum", fmt);
    expect(c.title).toMatch(/trial has ended/i);
    expect(c.body).toMatch(/nothing has been deleted/i);
    expect(c.body).toContain("2026-09-01");
    expect(c.body).toContain("Hotel Cabacum");
  });

  it("makes a real offer to a hotel that has never had it", () => {
    const s = productAccessState({ product: "pms", trials: [], entitlements: ALL_OFF });
    const c = productAccessCopy(s, "Hotel Cabacum", fmt);
    expect(c.body).toMatch(/30 days/);
    expect(c.body).toMatch(/no card/i);
    // And it says what the product is for, in the hotel's words.
    expect(c.body).toContain("Front desk and housekeeping");
  });

  it("never tells a hotel that ran a trial it 'hasn't subscribed'", () => {
    // The exact sentence that used to be shown to all three cases.
    for (const trials of [[expired("cm")], [expired("cm", { outcome: "cancelled" })]]) {
      const s = productAccessState({ product: "cm", trials, entitlements: ALL_OFF });
      const c = productAccessCopy(s, "Hotel X", fmt);
      expect(`${c.title} ${c.body}`).not.toMatch(/hasn.t subscribed/i);
    }
  });
});
