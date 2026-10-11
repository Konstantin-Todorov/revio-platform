import { describe, expect, it } from "vitest";
import { revenueHints, REVENUE_HINT_LIMIT, type HintNight } from "./revenue-hints.js";

const base = (over: Partial<HintNight>): HintNight => ({
  date: "2026-11-20",
  daysOut: 10,
  roomTypeId: "dbl",
  roomTypeName: "Double",
  capacity: 10,
  sold: 0,
  priceMinor: 10_000,
  soldWeekAgo: null,
  soldLastYear: null,
  ...over,
});

const day = (i: number) => `2026-11-${String(10 + i).padStart(2, "0")}`;

describe("filling_fast", () => {
  it("flags a night ≥ 75% sold a week or more out", () => {
    const [h] = revenueHints([base({ sold: 8 })]);
    expect(h).toMatchObject({ kind: "filling_fast", sold: 8, capacity: 10 });
  });

  it("flags fast pickup even below 75%", () => {
    // 7 of 10 sold, 4 of them this week, 3 left (≤ 40% of 10).
    const [h] = revenueHints([base({ sold: 7, soldWeekAgo: 3 })]);
    expect(h).toMatchObject({ kind: "filling_fast", pickup: 4 });
  });

  it("stays silent inside a week — then it is about selling, not price", () => {
    expect(revenueHints([base({ sold: 9, daysOut: 5 })])).toEqual([]);
  });

  it("stays silent on a sold-out night: there is nothing left to price", () => {
    expect(revenueHints([base({ sold: 10 })])).toEqual([]);
  });

  it("ignores a single-room type, where 1 of 1 is not a trend", () => {
    expect(revenueHints([base({ capacity: 1, sold: 1 })])).toEqual([]);
  });
});

describe("flat_price", () => {
  const quiet = [1, 2, 3].map((i) => base({ date: day(i), daysOut: 10 + i, sold: 1, priceMinor: 9_000 }));

  it("flags a nearly-full night priced no higher than the quiet nights", () => {
    const hints = revenueHints([...quiet, base({ date: day(5), sold: 9, priceMinor: 9_000 })]);
    expect(hints[0]).toMatchObject({ kind: "flat_price", priceMinor: 9_000, quietPriceMinor: 9_000 });
    // It replaces filling_fast for the same night rather than saying it twice.
    expect(hints.filter((h) => "date" in h && h.date === day(5))).toHaveLength(1);
  });

  it("is quiet once the full night is already priced above the quiet ones", () => {
    const hints = revenueHints([...quiet, base({ date: day(5), sold: 9, priceMinor: 12_000 })]);
    expect(hints.map((h) => h.kind)).toEqual(["filling_fast"]);
  });

  it("needs three quiet nights before it knows the usual price", () => {
    const hints = revenueHints([...quiet.slice(0, 2), base({ date: day(5), sold: 9, priceMinor: 9_000 })]);
    expect(hints.map((h) => h.kind)).toEqual(["filling_fast"]);
  });
});

describe("unsold_soon", () => {
  it("flags a mostly empty night one to three days away", () => {
    const [h] = revenueHints([base({ daysOut: 2, sold: 2 })]);
    expect(h).toMatchObject({ kind: "unsold_soon", daysOut: 2 });
  });

  it("leaves today to the front desk", () => {
    expect(revenueHints([base({ daysOut: 0, sold: 0 })])).toEqual([]);
  });

  it("stays silent with fewer than two rooms left", () => {
    expect(revenueHints([base({ daysOut: 2, capacity: 2, sold: 1 })])).toEqual([]);
  });
});

describe("behind_last_year", () => {
  const week = (sold: number, lastYear: number | null) =>
    Array.from({ length: 7 }, (_, i) => base({ date: day(i), daysOut: 8 + i, sold, soldLastYear: lastYear }));

  it("flags a week a week out that sold under 60% of last year", () => {
    const hints = revenueHints(week(1, 3));
    expect(hints).toContainEqual({ kind: "behind_last_year", from: day(0), to: day(6), sold: 7, soldLastYear: 21 });
  });

  it("is quiet when last year is too small to compare (< 6 room-nights)", () => {
    expect(revenueHints(week(0, 0)).some((h) => h.kind === "behind_last_year")).toBe(false);
  });

  it("is quiet with no history at all — a new hotel is not 'behind'", () => {
    expect(revenueHints(week(0, null))).toEqual([]);
  });

  it("is quiet when the week is at 60% or more of last year", () => {
    expect(revenueHints(week(2, 3)).some((h) => h.kind === "behind_last_year")).toBe(false);
  });
});

describe("runs of nights", () => {
  it("says a run of consecutive nights once, in room-nights", () => {
    const run = [0, 1, 2].map((i) => base({ date: day(i), daysOut: 1 + i, sold: 1, capacity: 4, priceMinor: 8_000 }));
    expect(revenueHints(run)).toEqual([
      expect.objectContaining({ kind: "unsold_soon", roomTypes: 1, date: day(0), to: day(2), nights: 3, sold: 3, capacity: 12, priceMinor: 8_000 }),
    ]);
  });

  it("drops the price when the nights in a run are priced differently", () => {
    const run = [0, 1].map((i) => base({ date: day(i), daysOut: 1 + i, sold: 0, capacity: 4, priceMinor: 8_000 + i * 1_000 }));
    expect(revenueHints(run)[0]).toMatchObject({ nights: 2, priceMinor: null });
  });

  it("says it once for the whole hotel when several rooms are empty on the same nights", () => {
    const rooms = ["dbl", "twn", "ste"].map((id) => base({ roomTypeId: id, roomTypeName: id, daysOut: 2, sold: 0, capacity: 4 }));
    expect(revenueHints(rooms)).toEqual([
      expect.objectContaining({ kind: "unsold_soon", roomTypes: 3, roomTypeName: "", sold: 0, capacity: 12, priceMinor: null }),
    ]);
  });

  it("keeps a gap as two lines", () => {
    const run = [0, 2].map((i) => base({ date: day(i), daysOut: 1 + i, sold: 0, capacity: 4 }));
    expect(revenueHints(run)).toHaveLength(2);
  });
});

describe("ranking", () => {
  it("puts the specific before the general and caps the list", () => {
    // Every other night, so they stay separate lines rather than merging into one run.
    const many = Array.from({ length: 12 }, (_, i) => base({ date: day(2 * i), daysOut: 7 + 2 * i, sold: 8 }));
    const hints = revenueHints([base({ date: "2026-11-09", daysOut: 2, sold: 0 }), ...many]);
    expect(hints).toHaveLength(REVENUE_HINT_LIMIT);
    expect(hints.every((h) => h.kind === "filling_fast")).toBe(true);
    // Sooner first within a kind.
    expect(hints[0]).toMatchObject({ date: day(0) });
  });

  it("never invents a hint on an empty window", () => {
    expect(revenueHints([])).toEqual([]);
  });
});
