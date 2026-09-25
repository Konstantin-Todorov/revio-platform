import { describe, expect, it } from "vitest";
import { describeProblem, pastDateRefusal, refusalMessage, type Capability, type OptionProblem } from "@revio/core";
import { rateErrors } from "./rate-errors";
import { common } from "./common";

/**
 * Refusals core writes in English and RevioCRS now words itself. RevioLink and RevioPMS still read
 * core's, so the CRS English must stay word for word the same.
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

  it("every capability refusal", () => {
    const a = common.en.authz;
    for (const cap of Object.keys(a.what) as Capability[]) {
      expect(a.readOnly(a.what[cap])).toBe(refusalMessage("read_only", cap));
    }
    // A role that can do some things but not this one — revenue managers may not touch channels.
    expect(a.cannot(a.what.manageDistribution)).toBe(refusalMessage("revenue_manager", "manageDistribution"));
  });
});
