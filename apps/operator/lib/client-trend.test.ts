import { describe, it, expect } from "vitest";
import {
  alignSeries, billedSeries, hasHistory, bookingSeries, monthKeys, monthLabel, mrrMovement, trimLeadingEmpty,
  type TrendInvoice,
} from "./client-trend";

const inv = (period: string, amountMinor: number, status = "paid", refundedMinor = 0): TrendInvoice =>
  ({ period, amountMinor, status, refundedMinor });

describe("monthKeys", () => {
  it("ends with the month containing 'now', oldest first", () => {
    expect(monthKeys(new Date("2026-09-15T00:00:00Z"), 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("⚠️ crosses a year boundary without inventing month 13", () => {
    // `new Date(y, m - i)` is the whole reason this is a function with a test rather than a loop
    // written inline: December to January is where hand-rolled month maths goes wrong.
    expect(monthKeys(new Date("2026-01-10T00:00:00Z"), 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("⚠️ labels every month in exactly three characters", () => {
    /*
     * `toLocaleString(…, { month: "short" })` gives "Sept" for September on current ICU, and a
     * different answer on a different Node build. Twelve labels across one axis cannot have one of
     * them a character wider than the rest, and certainly not depending on the machine.
     */
    expect(monthLabel("2026-09")).toBe("Sep");
    expect(monthLabel("2026-01")).toBe("Jan");
    for (let m = 1; m <= 12; m++) {
      expect(monthLabel(`2026-${String(m).padStart(2, "0")}`)).toHaveLength(3);
    }
  });
});

describe("billedSeries", () => {
  const months = ["2026-07", "2026-08", "2026-09"];

  it("bills into the right months and leaves the rest at zero", () => {
    const s = billedSeries([inv("2026-08", 11800), inv("2026-09", 11800)], months);
    expect(s.map((b) => b.value)).toEqual([0, 11800, 11800]);
  });

  it("⚠️ counts only a PAID invoice as paid", () => {
    const s = billedSeries([inv("2026-09", 11800, "sent")], months);
    expect(s.at(-1)).toMatchObject({ value: 11800, secondary: 0 });
  });

  it("⚠️ nets refunds out of paid — a refunded month is not our best one", () => {
    /*
     * Stripe can send money back after the invoice already says paid, which is why `refundedMinor`
     * exists at all. Drawing the gross would show a fully-refunded month as revenue.
     */
    const s = billedSeries([inv("2026-09", 11800, "paid", 11800)], months);
    expect(s.at(-1)).toMatchObject({ value: 11800, secondary: 0 });
    const partial = billedSeries([inv("2026-09", 11800, "paid", 1800)], months);
    expect(partial.at(-1)!.secondary).toBe(10000);
  });

  it("never draws paid above billed, even on a refund larger than the invoice", () => {
    // A data fault, not negative revenue to draw below the axis.
    const s = billedSeries([inv("2026-09", 5000, "paid", 9999)], months);
    expect(s.at(-1)!.secondary).toBe(0);
  });

  it("adds up two invoices landing in the same month", () => {
    const s = billedSeries([inv("2026-09", 5000), inv("2026-09", 2000)], months);
    expect(s.at(-1)).toMatchObject({ value: 7000, secondary: 7000 });
  });
});

describe("trimLeadingEmpty", () => {
  it("⚠️ drops months BEFORE the client existed, which are not a dip", () => {
    const s = trimLeadingEmpty([
      { label: "Jan", value: 0, secondary: 0 },
      { label: "Feb", value: 0, secondary: 0 },
      { label: "Mar", value: 100 },
    ]);
    expect(s.map((b) => b.label)).toEqual(["Mar"]);
  });

  it("⚠️ KEEPS an interior quiet month — very often that is the fact worth seeing", () => {
    // Removing the first kind is honesty. Removing this one would be flattery.
    const s = trimLeadingEmpty([{ label: "Mar", value: 100 }, { label: "Apr", value: 0 }, { label: "May", value: 100 }]);
    expect(s.map((b) => b.value)).toEqual([100, 0, 100]);
  });

  it("leaves an all-empty series alone rather than returning nothing", () => {
    // An empty array would make the chart render "No data yet", which is the truthful state anyway —
    // but silently returning [] from a trim function is a surprise the caller should not have to know.
    const all = [{ label: "Mar", value: 0 }, { label: "Apr", value: 0 }];
    expect(trimLeadingEmpty(all)).toHaveLength(2);
  });
});

describe("bookingSeries", () => {
  it("fills missing months with zero", () => {
    const s = bookingSeries(new Map([["2026-09", 12]]), ["2026-08", "2026-09"]);
    expect(s.map((b) => b.value)).toEqual([0, 12]);
  });
});

describe("mrrMovement", () => {
  it("measures from the earliest month we actually billed", () => {
    const m = mrrMovement([inv("2026-03", 5900), inv("2026-09", 11800)], 11800);
    expect(m).toMatchObject({ fromMinor: 5900, toMinor: 11800, deltaMinor: 5900, since: "Mar" });
  });

  it("reports a fall as plainly as a rise", () => {
    // Over-billing is reported as plainly as under-billing everywhere else in this console; a
    // shrinking client should not be the one number that hides.
    expect(mrrMovement([inv("2026-03", 11800)], 5900)?.deltaMinor).toBe(-5900);
  });

  it("⚠️ is null when there is nothing to compare against", () => {
    // "+€0 since September" on a client onboarded in September states a comparison nobody made.
    expect(mrrMovement([], 11800)).toBeNull();
    expect(mrrMovement([inv("2026-09", 11800)], 11800)).toBeNull();
  });

  it("ignores zero-value invoices when deciding where the history starts", () => {
    // A €0 draft for a trialling client is not the month their price began.
    expect(mrrMovement([inv("2026-01", 0), inv("2026-06", 5900)], 11800)?.since).toBe("Jun");
  });
});

describe("alignSeries", () => {
  const money = [{ label: "Mar", value: 100 }, { label: "Apr", value: 100 }, { label: "May", value: 100 }];
  const books = [{ label: "Mar", value: 0 }, { label: "Apr", value: 0 }, { label: "May", value: 7 }];

  it("⚠️ gives every series the SAME window — two charts on a row must share an axis", () => {
    /*
     * Trimming each on its own put seven months beside two on the client page. Two charts that do
     * not share an x-axis are not a comparison; the reader takes a conclusion from their shapes that
     * nothing supports. Caught by looking at the page, not by any test that existed.
     */
    const [a, b] = alignSeries([money, books]);
    expect(a!.map((x) => x.label)).toEqual(["Mar", "Apr", "May"]);
    expect(b!.map((x) => x.label)).toEqual(["Mar", "Apr", "May"]);
  });

  it("starts at the earliest evidence in ANY series, not the latest", () => {
    // The relationship began when the first thing happened, whichever series recorded it.
    const late = [{ label: "Mar", value: 0 }, { label: "Apr", value: 0 }, { label: "May", value: 5 }];
    const [a] = alignSeries([late, books]);
    expect(a!.map((x) => x.label)).toEqual(["May"]);
  });

  it("leaves everything alone when nothing has happened anywhere", () => {
    const empty = [{ label: "Mar", value: 0 }, { label: "Apr", value: 0 }];
    expect(alignSeries([empty, empty]).every((s) => s.length === 2)).toBe(true);
  });
});

describe("hasHistory", () => {
  it("⚠️ is false when every month in every series is zero", () => {
    // Twelve zero bars is not an empty chart — it is a flat line along the axis, which reads as a
    // rendering fault rather than as a customer who signed up last week.
    expect(hasHistory([[{ label: "Aug", value: 0, secondary: 0 }], [{ label: "Aug", value: 0 }]])).toBe(false);
  });

  it("is true on the strength of ANY series", () => {
    // Billed nothing but taking bookings is not "no history" — it is the live-and-uninvoiced case
    // this console exists to catch.
    expect(hasHistory([[{ label: "Aug", value: 0 }], [{ label: "Aug", value: 3 }]])).toBe(true);
  });

  it("counts a paid-only month, not just billed", () => {
    expect(hasHistory([[{ label: "Aug", value: 0, secondary: 500 }]])).toBe(true);
  });
});
