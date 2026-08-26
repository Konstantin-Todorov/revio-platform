import { describe, expect, it } from "vitest";
import { PLATFORM_MILESTONES, PLATFORM_ROADMAP, initiativesFor, milestoneYears } from "./platform-history";

describe("platform history", () => {
  it("keeps milestone ids unique and dates in chronological order", () => {
    expect(new Set(PLATFORM_MILESTONES.map((item) => item.id)).size).toBe(PLATFORM_MILESTONES.length);
    expect(PLATFORM_MILESTONES.map((item) => item.date)).toEqual(
      [...PLATFORM_MILESTONES].map((item) => item.date).sort(),
    );
  });

  it("gives every milestone evidence instead of an unsupported claim", () => {
    expect(PLATFORM_MILESTONES.every((item) => item.evidence.length > 0)).toBe(true);
  });

  it("keeps roadmap ids unique and every Now item mandatory", () => {
    expect(new Set(PLATFORM_ROADMAP.map((item) => item.id)).size).toBe(PLATFORM_ROADMAP.length);
    expect(initiativesFor("now").every((item) => item.priority === "must")).toBe(true);
  });

  it("contains all three planning horizons and derives years", () => {
    expect(initiativesFor("now").length).toBeGreaterThan(0);
    expect(initiativesFor("next").length).toBeGreaterThan(0);
    expect(initiativesFor("later").length).toBeGreaterThan(0);
    expect(milestoneYears()).toEqual([2026]);
  });
});
