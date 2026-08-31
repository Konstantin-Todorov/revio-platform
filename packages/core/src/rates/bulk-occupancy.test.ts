import { describe, it, expect } from "vitest";
import {
  matrixRows, applyOp, expandOffsets, planBulkOccupancy, describeBulkPlan,
  type BulkTargetRoom, type OccupancyEdit,
} from "./bulk-occupancy.js";
import { planCeiling } from "./pricing-model-switch.js";

const dbl: BulkTargetRoom = { roomTypeId: "dbl", roomName: "Deluxe Double", maxOccupancy: 2 };
const fam: BulkTargetRoom = { roomTypeId: "fam", roomName: "Family", maxOccupancy: 4 };

describe("mixed caps — the rule that inverts the plan-level one", () => {
  it("renders rows to the HIGHEST cap in the selection", () => {
    // Rendering to the smallest would hide the Family's 3- and 4-guest prices behind a Double that
    // happens to be selected, with no way to reach them.
    expect(matrixRows([dbl, fam]).map((r) => r.occupancy)).toEqual([1, 2, 3, 4]);
  });

  it("is deliberately the opposite of planCeiling, which takes the smallest", () => {
    const rooms = [dbl, fam];
    expect(planCeiling(rooms.map((r) => ({ maxOccupancy: r.maxOccupancy })))).toBe(2);
    expect(matrixRows(rooms).length).toBe(4);
  });

  it("names which rooms each row reaches and which it does not", () => {
    const rows = matrixRows([dbl, fam]);
    expect(rows[1]).toMatchObject({ occupancy: 2, appliesTo: ["Deluxe Double", "Family"], skippedBy: [] });
    expect(rows[3]).toMatchObject({ occupancy: 4, appliesTo: ["Family"], skippedBy: ["Deluxe Double"] });
  });

  it("NEVER writes an occupancy a room cannot sleep", () => {
    const plan = planBulkOccupancy({
      rooms: [dbl, fam], ratePlanIds: ["p1"], dateKeys: ["2026-09-01"],
      edits: [1, 2, 3, 4].map((occupancy) => ({ occupancy, op: "set" as const, value: 100 })),
      currentMinor: () => 10000,
    });
    expect(plan.writes.filter((w) => w.roomTypeId === "dbl").map((w) => w.occupancy)).toEqual([1, 2]);
    expect(plan.writes.filter((w) => w.roomTypeId === "fam").map((w) => w.occupancy)).toEqual([1, 2, 3, 4]);
  });

  it("reports the skip rather than doing less in silence", () => {
    const plan = planBulkOccupancy({
      rooms: [dbl, fam], ratePlanIds: ["p1"], dateKeys: ["2026-09-01"],
      edits: [{ occupancy: 3, op: "set", value: 140 }],
      currentMinor: () => 10000,
    });
    expect(plan.skipped).toEqual([{ roomName: "Deluxe Double", occupancies: [3] }]);
    expect(describeBulkPlan(plan)).toMatch(/Deluxe Double sleeps fewer than 3/);
  });
});

describe("applyOp", () => {
  it("sets, increases and decreases", () => {
    expect(applyOp(10000, "set", 120)).toBe(12000);
    expect(applyOp(10000, "inc_pct", 10)).toBe(11000);
    expect(applyOp(10000, "dec_pct", 10)).toBe(9000);
    expect(applyOp(10000, "inc_amt", 15)).toBe(11500);
    expect(applyOp(10000, "dec_amt", 15)).toBe(8500);
  });
  it("never produces a negative price — Channex rejects one inside an HTTP 200", () => {
    expect(applyOp(1000, "dec_amt", 50)).toBe(0);
    expect(applyOp(1000, "dec_pct", 200)).toBe(0);
  });
});

describe("primary + offsets", () => {
  it("compounds per STEP from the primary, which is what 'per extra guest' means", () => {
    // Primary 2 at €100, each extra guest +€20 → 3 guests €120, 4 guests €140.
    const edits = expandOffsets([1, 2, 3, 4], 2, 100, { perGuestAbove: { op: "inc_amt", value: 20 } });
    expect(edits.map((e) => e.value)).toEqual([100, 100, 120, 140]);
  });

  it("applies a downward rule below the primary", () => {
    const edits = expandOffsets([1, 2, 3], 2, 100, { perGuestBelow: { op: "dec_amt", value: 25 } });
    expect(edits.find((e) => e.occupancy === 1)!.value).toBe(75);
  });

  it("compounds a percentage per step, not once", () => {
    // +10% per extra guest from 100: 110, then 121 — not 120.
    const edits = expandOffsets([2, 3, 4], 2, 100, { perGuestAbove: { op: "inc_pct", value: 10 } });
    expect(edits.map((e) => e.value)).toEqual([100, 110, 121]);
  });

  it("leaves an occupancy alone when no rule covers its direction", () => {
    const edits = expandOffsets([1, 2, 3], 2, 100, { perGuestAbove: { op: "inc_amt", value: 20 } });
    expect(edits.find((e) => e.occupancy === 1)!.value).toBe(100);
  });

  it("always produces an explicit set — the caller never re-derives", () => {
    const edits = expandOffsets([1, 2], 2, 100, { perGuestBelow: { op: "dec_pct", value: 20 } });
    expect(edits.every((e) => e.op === "set")).toBe(true);
  });
});

describe("percentage edits with nothing to work from", () => {
  const edits: OccupancyEdit[] = [{ occupancy: 2, op: "inc_pct", value: 10 }];

  it("skips them and counts them rather than writing zero", () => {
    // A percentage of nothing is nothing; writing 0 would set a free room.
    const plan = planBulkOccupancy({
      rooms: [dbl], ratePlanIds: ["p1"], dateKeys: ["2026-09-01", "2026-09-02"],
      edits, currentMinor: () => null,
    });
    expect(plan.writes).toHaveLength(0);
    expect(plan.unpriced).toBe(2);
    expect(describeBulkPlan(plan)).toMatch(/no price yet/);
  });

  it("but a `set` needs nothing to work from and goes through", () => {
    const plan = planBulkOccupancy({
      rooms: [dbl], ratePlanIds: ["p1"], dateKeys: ["2026-09-01"],
      edits: [{ occupancy: 2, op: "set", value: 130 }], currentMinor: () => null,
    });
    expect(plan.writes).toEqual([
      { roomTypeId: "dbl", ratePlanId: "p1", dateKey: "2026-09-01", occupancy: 2, minor: 13000 },
    ]);
  });
});

describe("the cross product", () => {
  it("covers every room × plan × date × occupancy that applies", () => {
    const plan = planBulkOccupancy({
      rooms: [dbl, fam], ratePlanIds: ["p1", "p2"], dateKeys: ["2026-09-01", "2026-09-02"],
      edits: [1, 2, 3].map((occupancy) => ({ occupancy, op: "set" as const, value: 100 })),
      currentMinor: () => 10000,
    });
    // Double: 2 occupancies × 2 plans × 2 dates = 8. Family: 3 × 2 × 2 = 12.
    expect(plan.writes).toHaveLength(20);
  });

  it("says plainly when nothing will change", () => {
    const plan = planBulkOccupancy({
      rooms: [], ratePlanIds: ["p1"], dateKeys: ["2026-09-01"], edits: [], currentMinor: () => 100,
    });
    expect(describeBulkPlan(plan)).toMatch(/Nothing to change/);
  });
});
