import { describe, it, expect } from "vitest";
import { summariseOutcomes, outcomeHeadline, FOLIO_OUTCOMES, describeResolution, resolutionConfirmation } from "./folio-outcomes";

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

/*
 * ---------------------------------------------------------------------------------------------
 * The reported bug: "when you click to mark paid nothing happens, no error, no message at all."
 *
 * The action was working. What was missing was any way for the SCREEN to tell a decided folio from
 * an undecided one — it branched on the balance, and none of the four resolutions changes a balance.
 * ---------------------------------------------------------------------------------------------
 */
describe("describeResolution — decided is not the same as settled", () => {
  it("returns nothing while nobody has decided", () => {
    // The only state that should show the red banner and the four buttons.
    expect(describeResolution(null)).toBeNull();
    expect(describeResolution(undefined)).toBeNull();
    expect(describeResolution("")).toBeNull();
  });

  it("recognises a folio marked paid off-system, even though its balance is unchanged", () => {
    const d = describeResolution("paid_offsystem")!;
    expect(d.tone).toBe("collected");
    expect(d.stillOwed).toBe(false);
    // The sentence has to explain the balance still showing, or the screen contradicts itself.
    expect(d.meaning).toMatch(/still shows a balance|nothing was posted/i);
  });

  it("keeps a receivable on the list, because that is what the decision means", () => {
    const d = describeResolution("outstanding")!;
    expect(d.stillOwed).toBe(true);
    expect(d.tone).toBe("owed");
  });

  it("never reports a write-off as money collected", () => {
    // The distinction the whole module exists for: one is revenue, one is a loss.
    expect(describeResolution("written_off")!.tone).toBe("lost");
    expect(describeResolution("written_off")!.stillOwed).toBe(false);
  });

  it("returns nothing for an outcome it does not recognise, rather than guessing", () => {
    // A new value must surface as missing, never as a confident "collected".
    expect(describeResolution("refunded_somehow")).toBeNull();
  });
});

describe("resolutionConfirmation — what the person who pressed the button is told", () => {
  it("names the amount, because the balance on screen will not move", () => {
    for (const r of ["paid_offsystem", "receivable", "written_off"]) {
      expect(resolutionConfirmation(r, "513.00"), r).toContain("513.00");
    }
  });

  it("says what happens to the money, differently for each", () => {
    expect(resolutionConfirmation("paid_offsystem", "513.00")).toMatch(/collected/i);
    expect(resolutionConfirmation("written_off", "513.00")).toMatch(/loss/i);
    expect(resolutionConfirmation("receivable", "513.00")).toMatch(/receivables list/i);
    expect(resolutionConfirmation("reopen", "513.00")).toMatch(/close at zero/i);
  });

  it("never calls a write-off a payment", () => {
    expect(resolutionConfirmation("written_off", "513.00")).toMatch(/never as a payment/i);
  });

  it("still says something for an unknown resolution", () => {
    // Silence is the failure this whole change is about.
    expect(resolutionConfirmation("nonsense", "1.00").length).toBeGreaterThan(0);
  });
});
