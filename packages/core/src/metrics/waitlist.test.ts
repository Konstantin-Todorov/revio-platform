import { describe, it, expect } from "vitest";
import { waitlistMetrics, median, type WaitlistEntryMetricFact } from "./waitlist";

const JOINED = new Date("2026-09-01T10:00:00.000Z");
const laterMinutes = (m: number) => new Date(JOINED.getTime() + m * 60_000);

function entry(over: Partial<WaitlistEntryMetricFact> = {}): WaitlistEntryMetricFact {
  return {
    status: "waiting",
    createdAt: JOINED,
    offeredAt: null,
    offerCount: 0,
    recoveredMinor: null,
    ...over,
  };
}

describe("median", () => {
  it("is null for nothing", () => {
    expect(median([])).toBeNull();
  });

  it("takes the middle of an odd count", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values of an even count", () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("does not mutate its argument", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("waitlistMetrics — counting", () => {
  it("reports zeroes and nulls for an empty list", () => {
    const m = waitlistMetrics([]);
    expect(m.entries).toBe(0);
    expect(m.recoveredMinor).toBe(0);
    // Null, never 0 — nothing has been asked of this waitlist yet.
    expect(m.offerConversionRate).toBeNull();
    expect(m.demandRecoveryRate).toBeNull();
    expect(m.medianMinutesToOffer).toBeNull();
  });

  it("splits entries across the statuses", () => {
    const m = waitlistMetrics([
      entry({ status: "waiting" }),
      entry({ status: "offered", offeredAt: laterMinutes(10), offerCount: 1 }),
      entry({ status: "converted", offeredAt: laterMinutes(10), offerCount: 1, recoveredMinor: 19_500 }),
      entry({ status: "expired" }),
      entry({ status: "cancelled" }),
    ]);

    expect(m.entries).toBe(5);
    expect(m.stillWaiting).toBe(1);
    expect(m.converted).toBe(1);
    expect(m.expired).toBe(1);
    expect(m.cancelled).toBe(1);
  });

  it("counts every offer, not every entry offered", () => {
    const m = waitlistMetrics([
      entry({ offeredAt: laterMinutes(5), offerCount: 3 }),
      entry({ offeredAt: laterMinutes(5), offerCount: 1 }),
    ]);

    expect(m.offered).toBe(2);
    expect(m.offersMade).toBe(4);
  });

  it("does not let a negative offerCount subtract from the total", () => {
    const m = waitlistMetrics([entry({ offerCount: -3 }), entry({ offerCount: 2, offeredAt: laterMinutes(1) })]);
    expect(m.offersMade).toBe(2);
  });
});

describe("waitlistMetrics — what counts as offered", () => {
  it("counts an entry that was offered and converted", () => {
    // The bug this pins: counting `status === "offered"` would exclude, by construction, every
    // offer that actually worked — because a converted entry no longer reads "offered".
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(30), offerCount: 1, recoveredMinor: 10_000 }),
    ]);

    expect(m.offered).toBe(1);
    expect(m.offerConversionRate).toBe(1);
  });

  it("counts an entry whose offer lapsed and went back to waiting", () => {
    const m = waitlistMetrics([entry({ status: "waiting", offeredAt: laterMinutes(30), offerCount: 1 })]);

    expect(m.offered).toBe(1);
    expect(m.stillWaiting).toBe(1);
    expect(m.offerConversionRate).toBe(0);
  });

  it("does not count an entry that was never offered anything", () => {
    const m = waitlistMetrics([entry({ status: "expired" })]);

    expect(m.offered).toBe(0);
    expect(m.offerConversionRate).toBeNull();
  });
});

describe("waitlistMetrics — the two rates", () => {
  it("keeps offer conversion and demand recovery apart", () => {
    // One cancellation all month, converted. Both sentences are true and they are very different.
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(60), offerCount: 1, recoveredMinor: 24_000 }),
      ...Array.from({ length: 29 }, () => entry({ status: "waiting" })),
    ]);

    expect(m.offerConversionRate).toBe(1);
    expect(m.demandRecoveryRate).toBeCloseTo(1 / 30, 10);
  });

  it("reports a failed offer as 0, distinct from never having offered", () => {
    const failed = waitlistMetrics([entry({ status: "expired", offeredAt: laterMinutes(5), offerCount: 1 })]);
    const neverAsked = waitlistMetrics([entry({ status: "waiting" })]);

    expect(failed.offerConversionRate).toBe(0);
    expect(neverAsked.offerConversionRate).toBeNull();
  });

  it("divides by offers for one rate and by entries for the other", () => {
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 100 }),
      entry({ status: "waiting", offeredAt: laterMinutes(1), offerCount: 1 }),
      entry({ status: "waiting" }),
      entry({ status: "waiting" }),
    ]);

    expect(m.offerConversionRate).toBe(0.5);
    expect(m.demandRecoveryRate).toBe(0.25);
  });
});

describe("waitlistMetrics — revenue recovered", () => {
  it("sums the accommodation value of converted entries", () => {
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 19_500 }),
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 30_000 }),
    ]);

    expect(m.recoveredMinor).toBe(49_500);
  });

  it("ignores value attached to an entry that did not convert", () => {
    // Defensive: a caller should not send one, and if it does it must not inflate recovered revenue.
    const m = waitlistMetrics([entry({ status: "waiting", recoveredMinor: 99_999 })]);

    expect(m.recoveredMinor).toBe(0);
  });

  it("counts a converted entry whose stay has been removed, without inventing revenue", () => {
    // `reservationId` is SET NULL, so this is reachable. Counting it as converted with 0 revenue
    // silently understates recovery; naming it lets the screen say why the two disagree.
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: null }),
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 20_000 }),
    ]);

    expect(m.converted).toBe(2);
    expect(m.convertedWithoutValue).toBe(1);
    expect(m.recoveredMinor).toBe(20_000);
  });

  it("keeps money in integer minor units", () => {
    const m = waitlistMetrics([
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 1 }),
      entry({ status: "converted", offeredAt: laterMinutes(1), offerCount: 1, recoveredMinor: 2 }),
    ]);

    expect(Number.isInteger(m.recoveredMinor)).toBe(true);
    expect(m.recoveredMinor).toBe(3);
  });
});

describe("waitlistMetrics — time to offer", () => {
  it("measures from joining to being offered", () => {
    const m = waitlistMetrics([entry({ offeredAt: laterMinutes(90), offerCount: 1 })]);
    expect(m.medianMinutesToOffer).toBe(90);
  });

  it("takes the median so one long wait cannot distort it", () => {
    const m = waitlistMetrics([
      entry({ offeredAt: laterMinutes(10), offerCount: 1 }),
      entry({ offeredAt: laterMinutes(20), offerCount: 1 }),
      entry({ offeredAt: laterMinutes(60 * 24 * 21), offerCount: 1 }),
    ]);

    // The mean would be over a week; no guest experienced anything like that.
    expect(m.medianMinutesToOffer).toBe(20);
  });

  it("ignores entries that were never offered", () => {
    const m = waitlistMetrics([
      entry({ offeredAt: laterMinutes(10), offerCount: 1 }),
      entry({ status: "waiting" }),
      entry({ status: "expired" }),
    ]);

    expect(m.medianMinutesToOffer).toBe(10);
  });

  it("floors a clock-skewed negative reading at zero rather than dropping the row", () => {
    const m = waitlistMetrics([
      entry({ offeredAt: new Date(JOINED.getTime() - 60_000), offerCount: 1 }),
      entry({ offeredAt: laterMinutes(10), offerCount: 1 }),
    ]);

    expect(m.medianMinutesToOffer).toBe(5);
  });

  it("rounds to whole minutes", () => {
    const m = waitlistMetrics([entry({ offeredAt: new Date(JOINED.getTime() + 100_000), offerCount: 1 })]);
    expect(m.medianMinutesToOffer).toBe(2);
  });
});
