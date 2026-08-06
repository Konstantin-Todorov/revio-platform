import { describe, expect, it } from "vitest";
import { demoNote, partitionDemo } from "./demo.js";

const c = (name: string, isDemo: boolean) => ({ name, isDemo });

describe("partitionDemo", () => {
  it("separates business from testing", () => {
    const { real, demo } = partitionDemo([c("Grand Marina", false), c("Hotel Sofia", true), c("Alpine Lodge", false)]);
    expect(real.map((r) => r.name)).toEqual(["Grand Marina", "Alpine Lodge"]);
    expect(demo.map((r) => r.name)).toEqual(["Hotel Sofia"]);
  });

  it("keeps input order inside each side", () => {
    // The lists it feeds are already sorted (by MRR, by name, by urgency); partitioning must not
    // quietly reshuffle them.
    const rows = ["a", "b", "c", "d"].map((n, i) => c(n, i % 2 === 1));
    expect(partitionDemo(rows).real.map((r) => r.name)).toEqual(["a", "c"]);
    expect(partitionDemo(rows).demo.map((r) => r.name)).toEqual(["b", "d"]);
  });

  it("handles a portfolio that is all demo — the state on day one", () => {
    const { real, demo } = partitionDemo([c("Hotel Sofia", true), c("Black Sea", true)]);
    expect(real).toEqual([]);
    expect(demo).toHaveLength(2);
  });

  it("handles a portfolio with no demo at all", () => {
    const { real, demo } = partitionDemo([c("Grand Marina", false)]);
    expect(real).toHaveLength(1);
    expect(demo).toEqual([]);
  });
});

describe("demoNote", () => {
  it("says nothing when there is nothing to disclose", () => {
    expect(demoNote(0)).toBeNull();
  });

  it("discloses the exclusion, singular and plural", () => {
    expect(demoNote(1)).toContain("1 demo client excluded");
    expect(demoNote(2)).toContain("2 demo clients excluded");
  });
});
