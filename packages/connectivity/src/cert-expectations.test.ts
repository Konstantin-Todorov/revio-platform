import { describe, expect, it } from "vitest";
import { CERT_TESTS, rowDays, verifyTest, type WireRow, type Expectation } from "./cert-expectations.js";

const IDS: Record<Expectation["product"], string> = {
  "twin-bar": "TB", "twin-bnb": "TN", "double-bar": "DB", "double-bnb": "DN",
  "twin-room": "TR", "double-room": "DR",
};
const spec = (id: number) => CERT_TESTS.find((t) => t.id === id)!;

describe("rowDays", () => {
  it("expands a range inclusively", () => {
    expect(rowDays({ date_from: "2026-11-01", date_to: "2026-11-03" })).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });
  it("handles a single date and an empty row", () => {
    expect(rowDays({ date: "2026-11-22" })).toEqual(["2026-11-22"]);
    expect(rowDays({})).toEqual([]);
  });
});

describe("verifyTest — test 2 (single date, single rate)", () => {
  const good: WireRow[] = [{ rate_plan_id: "TB", date: "2026-11-22", rate: 33300 }];

  it("passes the exact payload the spec asks for", () => {
    expect(verifyTest(spec(2), good, 1, IDS)).toMatchObject({ pass: true, problems: [] });
  });

  it("FAILS when the rate is ours instead of theirs", () => {
    // The literal rejection line: "rate is $125.0, expected $333.0".
    const v = verifyTest(spec(2), [{ rate_plan_id: "TB", date: "2026-11-22", rate: 12500 }], 1, IDS);
    expect(v.pass).toBe(false);
    expect(v.problems[0]).toContain("rate is 12500, expected 33300");
  });

  it("FAILS when the row carries restrictions the test did not name", () => {
    // The failure that hit tests 2, 3 and 4: stop_sell:false is an instruction, not a no-op.
    const v = verifyTest(spec(2), [{ ...good[0]!, stop_sell: false, closed_to_arrival: false }], 1, IDS);
    expect(v.pass).toBe(false);
    expect(v.problems.some((p) => p.includes("stop_sell"))).toBe(true);
  });

  it("FAILS when the push spans days the test never asked about", () => {
    // What the 14-day horizon push would have produced from the UI.
    const v = verifyTest(spec(2), [{ rate_plan_id: "TB", date_from: "2026-11-22", date_to: "2026-12-05", rate: 33300 }], 1, IDS);
    expect(v.pass).toBe(false);
    expect(v.problems.some((p) => p.includes("did not ask for"))).toBe(true);
  });

  it("FAILS when it took more than one API call", () => {
    expect(verifyTest(spec(2), good, 2, IDS).problems[0]).toContain("expected 1 API call");
  });
});

describe("verifyTest — ranges and coverage", () => {
  it("accepts a merged range covering exactly the required days", () => {
    const rows: WireRow[] = [
      { rate_plan_id: "TB", date_from: "2026-11-01", date_to: "2026-11-10", rate: 24100 },
      { rate_plan_id: "DB", date_from: "2026-11-10", date_to: "2026-11-16", rate: 31266 },
      { rate_plan_id: "DN", date_from: "2026-11-01", date_to: "2026-11-20", rate: 11100 },
    ];
    expect(verifyTest(spec(4), rows, 1, IDS).pass).toBe(true);
  });

  it("FAILS on the wrong month — the December-for-November error", () => {
    const v = verifyTest(spec(4), [
      { rate_plan_id: "TB", date_from: "2026-12-01", date_to: "2026-12-10", rate: 24100 },
      { rate_plan_id: "DB", date_from: "2026-11-10", date_to: "2026-11-16", rate: 31266 },
      { rate_plan_id: "DN", date_from: "2026-11-01", date_to: "2026-11-20", rate: 11100 },
    ], 1, IDS);
    expect(v.pass).toBe(false);
    expect(v.problems[0]).toContain("expected 2026-11-01..2026-11-10");
  });

  it("FAILS when a product is missing entirely", () => {
    const v = verifyTest(spec(4), [{ rate_plan_id: "TB", date_from: "2026-11-01", date_to: "2026-11-10", rate: 24100 }], 1, IDS);
    expect(v.problems.some((p) => p.includes("no rows at all"))).toBe(true);
  });

  it("warns about unmerged single dates on a range test", () => {
    const rows: WireRow[] = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]
      .map((d) => ({ rate_plan_id: "TB", date: `2026-11-${d}`, rate: 24100 }));
    rows.push({ rate_plan_id: "DB", date_from: "2026-11-10", date_to: "2026-11-16", rate: 31266 });
    rows.push({ rate_plan_id: "DN", date_from: "2026-11-01", date_to: "2026-11-20", rate: 11100 });
    const v = verifyTest(spec(4), rows, 1, IDS);
    expect(v.pass).toBe(true); // a warning, not a failure — Channex flags it as ⚠
    expect(v.warnings[0]).toContain("date_range");
  });
});

describe("verifyTest — the restriction tests", () => {
  it("passes test 7 including max_stay, which we omitted last time", () => {
    const rows: WireRow[] = [
      { rate_plan_id: "TB", date_from: "2026-11-01", date_to: "2026-11-10", closed_to_arrival: true, closed_to_departure: false, max_stay: 4, min_stay_arrival: 1, min_stay_through: 1 },
      { rate_plan_id: "TN", date_from: "2026-11-12", date_to: "2026-11-16", closed_to_arrival: false, closed_to_departure: true, min_stay_arrival: 6, min_stay_through: 6 },
      { rate_plan_id: "DB", date_from: "2026-11-10", date_to: "2026-11-16", closed_to_arrival: true, min_stay_arrival: 2, min_stay_through: 2 },
      { rate_plan_id: "DN", date_from: "2026-11-01", date_to: "2026-11-20", min_stay_arrival: 10, min_stay_through: 10 },
    ];
    expect(verifyTest(spec(7), rows, 1, IDS)).toMatchObject({ pass: true });
  });

  it("FAILS test 7 when max_stay is missing — 2000/2000 objects were", () => {
    const rows: WireRow[] = [
      { rate_plan_id: "TB", date_from: "2026-11-01", date_to: "2026-11-10", closed_to_arrival: true, closed_to_departure: false, min_stay_arrival: 1, min_stay_through: 1 },
    ];
    const v = verifyTest(spec(7), rows, 1, IDS);
    expect(v.problems.some((p) => p.includes("max_stay"))).toBe(true);
  });

  it("FAILS a stop-sell test that also carries a rate", () => {
    const v = verifyTest(spec(6), [{ rate_plan_id: "TB", date: "2026-11-14", stop_sell: true, rate: 12000 }], 1, IDS);
    expect(v.problems.some((p) => p.includes('carries "rate"'))).toBe(true);
  });

  it("passes a clean stop-sell", () => {
    const rows: WireRow[] = [
      { rate_plan_id: "TB", date: "2026-11-14", stop_sell: true },
      { rate_plan_id: "DB", date: "2026-11-16", stop_sell: true },
      { rate_plan_id: "DN", date: "2026-11-20", stop_sell: true },
    ];
    expect(verifyTest(spec(6), rows, 1, IDS).pass).toBe(true);
  });
});

describe("the spec table itself", () => {
  it("covers tests 2-10 with no duplicates", () => {
    expect(CERT_TESTS.map((t) => t.id)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("uses minor units for every rate — $456.23 is 45623, not 456.23", () => {
    // A decimal here would be sent as $4.56 and read as a wrong rate, which is exactly the class of
    // error the first submission was made of.
    for (const t of CERT_TESTS) {
      for (const e of t.expectations) {
        if (e.values.rate != null) expect(Number.isInteger(e.values.rate)).toBe(true);
      }
    }
  });

  it("never forbids a field it also expects", () => {
    // A contradiction here would make a test unpassable by construction.
    for (const t of CERT_TESTS) {
      for (const e of t.expectations) {
        for (const field of Object.keys(e.values)) {
          expect(t.forbidden, `test ${t.id} expects and forbids ${field}`).not.toContain(field);
        }
      }
    }
  });
});
