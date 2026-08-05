import { describe, expect, it } from "vitest";
import { bucketForward, monthBuckets, type ForwardLine } from "./forward.js";

const AUG = monthBuckets(new Date("2026-08-01T00:00:00Z"), 6);
const line = (o: Partial<ForwardLine> & { checkIn: string; checkOut: string }): ForwardLine => ({
  quantity: 1,
  priceMinor: null,
  ...o,
});

describe("monthBuckets", () => {
  it("spans consecutive months, each ending where the next begins", () => {
    expect(AUG.map((b) => b.key)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]);
    expect(AUG[0]!.start).toBe("2026-08-01");
    expect(AUG[0]!.endExcl).toBe("2026-09-01"); // exclusive, matching how nights are counted
    expect(AUG[0]!.endExcl).toBe(AUG[1]!.start); // no gap, no overlap
  });

  it("rolls the year over", () => {
    expect(monthBuckets(new Date("2026-11-01T00:00:00Z"), 3).map((b) => b.key)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("bucketForward", () => {
  it("counts room-nights as rooms × nights, not rooms", () => {
    // The bug that shipped: a five-night booking of one room counted as 1.
    const r = bucketForward([line({ checkIn: "2026-08-03", checkOut: "2026-08-08" })], AUG);
    expect(r[0]!.roomNights).toBe(5);
  });

  it("multiplies by the number of rooms on the line", () => {
    const r = bucketForward([line({ checkIn: "2026-08-03", checkOut: "2026-08-06", quantity: 3 })], AUG);
    expect(r[0]!.roomNights).toBe(9); // 3 rooms × 3 nights
  });

  it("SPLITS a stay across the month boundary it crosses", () => {
    // The case production cannot demonstrate — every future stay in the database today begins and
    // ends inside one month, so a version ignoring boundaries entirely would look identical.
    // 30 Aug → 3 Sep is 4 nights: 2 in August (30th, 31st), 2 in September (1st, 2nd).
    const r = bucketForward([line({ checkIn: "2026-08-30", checkOut: "2026-09-03", priceMinor: 40_000 })], AUG);
    expect(r[0]!.roomNights).toBe(2);
    expect(r[1]!.roomNights).toBe(2);
    expect(r[0]!.revenueMinor).toBe(20_000); // prorated by nights, not dumped in the check-in month
    expect(r[1]!.revenueMinor).toBe(20_000);
  });

  it("keeps the split total equal to the stay's price", () => {
    // Proration must not invent or lose money. 7 nights over a boundary at an odd price.
    const r = bucketForward([line({ checkIn: "2026-08-29", checkOut: "2026-09-05", priceMinor: 100_001 })], AUG);
    const summed = r.reduce((s, b) => s + b.revenueMinor, 0);
    expect(summed).toBe(100_001);
  });

  it("attributes a stay entirely to one month when it does not cross", () => {
    // The shape of every stay currently in production — worth pinning so a future refactor that
    // breaks the simple case fails loudly too.
    const r = bucketForward([line({ checkIn: "2026-08-03", checkOut: "2026-08-07", priceMinor: 60_000 })], AUG);
    expect(r[0]).toEqual({ key: "2026-08", roomNights: 4, revenueMinor: 60_000 });
    expect(r[1]!.revenueMinor).toBe(0);
  });

  it("counts only the nights inside the window for a stay that starts before it", () => {
    // A stay running 28 Jul → 2 Aug contributes its August nights only (1st), not its July ones.
    const r = bucketForward([line({ checkIn: "2026-07-28", checkOut: "2026-08-02", priceMinor: 50_000 })], AUG);
    expect(r[0]!.roomNights).toBe(1);
    expect(r[0]!.revenueMinor).toBe(10_000); // 1 of 5 nights
  });

  it("ignores a line with no price without losing its room-nights", () => {
    // Legacy imports carry nights but no money. Dropping the line entirely would understate occupancy.
    const r = bucketForward([line({ checkIn: "2026-08-03", checkOut: "2026-08-06", priceMinor: null })], AUG);
    expect(r[0]!.roomNights).toBe(3);
    expect(r[0]!.revenueMinor).toBe(0);
  });

  it("skips a zero-night stay rather than dividing by zero", () => {
    const r = bucketForward([line({ checkIn: "2026-08-03", checkOut: "2026-08-03", priceMinor: 10_000 })], AUG);
    expect(r.every((b) => b.roomNights === 0 && b.revenueMinor === 0)).toBe(true);
  });

  it("returns a bucket per month even when nothing lands in it", () => {
    const r = bucketForward([], AUG);
    expect(r).toHaveLength(6);
    expect(r.every((b) => b.roomNights === 0 && b.revenueMinor === 0)).toBe(true);
  });

  it("reproduces the live production figures", () => {
    // The three stays actually on the books on 2026-08-05: 8 room-nights, €1,052, all in August.
    const r = bucketForward(
      [
        line({ checkIn: "2026-08-03", checkOut: "2026-08-07", priceMinor: 60_000 }),
        line({ checkIn: "2026-08-04", checkOut: "2026-08-06", priceMinor: 26_000 }),
        line({ checkIn: "2026-08-04", checkOut: "2026-08-06", priceMinor: 19_200 }),
      ],
      AUG,
    );
    expect(r[0]!.roomNights).toBe(8);
    expect(r[0]!.revenueMinor).toBe(105_200);
  });
});
