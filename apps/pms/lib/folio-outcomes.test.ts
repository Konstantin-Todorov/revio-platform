import { describe, it, expect } from "vitest";
import { summariseOutcomes, outcomeHeadline, FOLIO_OUTCOMES } from "./folio-outcomes";

const row = (outcome: string | null, grossMinor: number) => ({ outcome, grossMinor });

describe("summariseOutcomes", () => {
  it("keeps written off apart from paid off-system — the whole point of J1", () => {
    const totals = summariseOutcomes([
      row("paid_offsystem", 51300),
      row("written_off", 51300),
    ]);
    const paid = totals.find((t) => t.outcome === "paid_offsystem")!;
    const off = totals.find((t) => t.outcome === "written_off")!;
    expect(paid.amountMinor).toBe(51300);
    expect(off.amountMinor).toBe(51300);
    expect(paid.tone).toBe("collected");
    expect(off.tone).toBe("lost");
  });

  it("reports zeroes rather than omitting them", () => {
    // An absent row reads as "not measured", which is how a number stops being watched.
    const totals = summariseOutcomes([row("settled", 10000)]);
    expect(totals).toHaveLength(FOLIO_OUTCOMES.length);
    expect(totals.find((t) => t.outcome === "written_off")).toMatchObject({ count: 0, amountMinor: 0 });
  });

  it("always returns the same order", () => {
    expect(summariseOutcomes([]).map((t) => t.outcome)).toEqual([...FOLIO_OUTCOMES]);
  });

  it("ignores folios that are still open", () => {
    const totals = summariseOutcomes([row(null, 99999), row("settled", 100)]);
    expect(totals.reduce((s, t) => s + t.count, 0)).toBe(1);
  });

  it("skips an outcome it does not recognise instead of absorbing it", () => {
    // A new value must show up as missing, never as inflated "settled".
    const totals = summariseOutcomes([row("some_new_state", 50000), row("settled", 100)]);
    expect(totals.find((t) => t.outcome === "settled")!.amountMinor).toBe(100);
    expect(totals.reduce((s, t) => s + t.amountMinor, 0)).toBe(100);
  });

  it("counts folios as well as money", () => {
    const totals = summariseOutcomes([row("settled", 100), row("settled", 200), row("written_off", 50)]);
    expect(totals.find((t) => t.outcome === "settled")).toMatchObject({ count: 2, amountMinor: 300 });
    expect(totals.find((t) => t.outcome === "written_off")).toMatchObject({ count: 1, amountMinor: 50 });
  });

  it("gives every outcome a meaning, so a bare number cannot be misread", () => {
    for (const t of summariseOutcomes([])) expect(t.meaning.length).toBeGreaterThan(15);
  });
});

describe("outcomeHeadline", () => {
  it("adds the two collection routes together and leaves the other two out of it", () => {
    const h = outcomeHeadline(
      summariseOutcomes([
        row("settled", 10000),
        row("paid_offsystem", 5000),
        row("outstanding", 3000),
        row("written_off", 2000),
      ]),
    );
    expect(h.collectedMinor).toBe(15000);
    expect(h.owedMinor).toBe(3000);
    expect(h.lostMinor).toBe(2000);
  });

  it("never folds a loss into revenue", () => {
    const h = outcomeHeadline(summariseOutcomes([row("written_off", 51300)]));
    expect(h.collectedMinor).toBe(0);
    expect(h.lostMinor).toBe(51300);
  });

  it("keeps money still owed out of both — it is not yet either", () => {
    const h = outcomeHeadline(summariseOutcomes([row("outstanding", 8000)]));
    expect(h.collectedMinor).toBe(0);
    expect(h.lostMinor).toBe(0);
    expect(h.owedMinor).toBe(8000);
  });
});
