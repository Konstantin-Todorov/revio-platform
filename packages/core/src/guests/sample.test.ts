import { describe, it, expect } from "vitest";
import { hasPattern, sampleLabel, sampleNote, MIN_STAYS_FOR_PATTERN } from "./sample.js";

/**
 * The profile said "Average stay 3.0 nights" and "Usual room 404" from ONE visit. The numbers were
 * right; the words claimed a pattern that did not exist.
 */
describe("sampleLabel", () => {
  it("does not call one visit a pattern", () => {
    expect(sampleLabel(1, "Average stay", "Last stay")).toBe("Last stay");
    expect(sampleLabel(1, "Usual room", "Last room")).toBe("Last room");
  });

  it("uses the confident wording once there is repetition", () => {
    expect(sampleLabel(2, "Average stay", "Last stay")).toBe("Average stay");
    expect(sampleLabel(20, "Usual room", "Last room")).toBe("Usual room");
  });

  it("treats no history as no pattern", () => {
    expect(hasPattern(0)).toBe(false);
    expect(sampleLabel(0, "Average stay", "Last stay")).toBe("Last stay");
  });

  it("sits the threshold at two — one is an anecdote", () => {
    expect(MIN_STAYS_FOR_PATTERN).toBe(2);
    expect(hasPattern(1)).toBe(false);
    expect(hasPattern(2)).toBe(true);
  });
});

describe("sampleNote", () => {
  it("annotates a thin sample, because that is the whole caveat", () => {
    expect(sampleNote(1)).toBe("1 stay");
    expect(sampleNote(2)).toBe("2 stays");
  });

  it("says nothing once the average has earned the word", () => {
    // "· 14 stays" beside an average is noise; "· 1 stay" is the point.
    expect(sampleNote(14)).toBeNull();
  });

  it("says nothing when there is no history at all", () => {
    expect(sampleNote(0)).toBeNull();
  });
});
