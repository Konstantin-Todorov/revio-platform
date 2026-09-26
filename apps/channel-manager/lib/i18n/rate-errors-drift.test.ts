import { describe, expect, it } from "vitest";
import { describeProblem, pastDateRefusal, type OptionProblem } from "@revio/core";
import { rateErrors } from "./rate-errors";

/**
 * Refusals core writes in English and RevioLink words itself. RevioPMS still reads core's, so the
 * English here must stay word for word the same.
 */
describe("rate refusals match core, in English", () => {
  const en = rateErrors.en;

  it("a past date, with and without a label", () => {
    const bare = pastDateRefusal({ iso: "2026-01-02", earliest: "2026-03-04" })!;
    const [, a, b] = /^(.+) has already passed\. The earliest you can pick is (.+)\.$/.exec(bare)!;
    expect(en.past(null, a!, b!)).toBe(bare);
    expect(en.past(en.startDate, a!, b!)).toBe(pastDateRefusal({ label: "The start date", iso: "2026-01-02", earliest: "2026-03-04" }));
  });

  it("every occupancy problem", () => {
    const samples: OptionProblem[] = [
      { kind: "no-primary" }, { kind: "many-primaries", occupancies: [1, 2] },
      { kind: "per-room-extra-rows", count: 3 }, { kind: "per-room-wrong-occupancy", found: 1, expected: 2 },
      { kind: "gap", missing: [3] }, { kind: "gap", missing: [3, 4] }, { kind: "duplicate", occupancy: 2 },
      { kind: "above-ceiling", occupancy: 5, ceiling: 4 }, { kind: "below-one", occupancy: 0 },
      { kind: "derived-without-rule", occupancy: 3 }, { kind: "primary-derived" },
    ];
    for (const p of samples) {
      expect((en.problems[p.kind] as (x: OptionProblem) => string)(p)).toBe(describeProblem(p));
    }
  });
});
