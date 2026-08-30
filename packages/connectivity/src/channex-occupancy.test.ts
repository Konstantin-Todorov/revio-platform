import { describe, it, expect } from "vitest";
import {
  applyRates, usableRates, toChannexOptions, toDerivedOption, resolveRateMode,
} from "./channex-occupancy.js";

const base = { property_id: "prop", rate_plan_id: "rp", date: "2026-09-01" };
const rates = [
  { occupancy: 1, minor: 9000 },
  { occupancy: 2, minor: 12000 },
  { occupancy: 3, minor: 14000 },
];

describe("the two rate shapes", () => {
  it("per-room sends a scalar `rate` and no array", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_room", rates: [{ occupancy: 2, minor: 12000 }], primaryOccupancy: 2, channelSupportsOccupancy: true });
    expect(r.ok && r.value.rate).toBe(12000);
    expect(r.ok && r.value.rates).toBeUndefined();
  });

  it("per-person sends ONE object with every occupancy — not one object each", () => {
    // The crux. N objects would be accepted and multiply a year's push by max occupancy.
    const r = applyRates({ value: { ...base }, sellMode: "per_person", rates, primaryOccupancy: 2, channelSupportsOccupancy: true });
    expect(r.ok && r.value.rates).toEqual([
      { occupancy: 1, rate: 9000 },
      { occupancy: 2, rate: 12000 },
      { occupancy: 3, rate: 14000 },
    ]);
  });

  it("never sets both — leaving a stale scalar lets Channex choose what a hotel charges", () => {
    const r = applyRates({ value: { ...base, rate: 99999 }, sellMode: "per_person", rates, primaryOccupancy: 2, channelSupportsOccupancy: true });
    expect(r.ok && r.value.rate).toBeUndefined();
    expect(r.ok && r.value.rates).toBeDefined();
  });

  it("keeps restrictions at the TOP of the object, beside rates and never inside", () => {
    const r = applyRates({
      value: { ...base, min_stay_arrival: 2, stop_sell: false },
      sellMode: "per_person", rates, primaryOccupancy: 2, channelSupportsOccupancy: true,
    });
    expect(r.ok && r.value.min_stay_arrival).toBe(2);
    expect(r.ok && r.value.stop_sell).toBe(false);
  });
});

describe("zero and negative rates", () => {
  it("drops them — Channex rejects per-object inside an HTTP 200", () => {
    expect(usableRates([{ occupancy: 1, minor: 0 }, { occupancy: 2, minor: -5 }, { occupancy: 3, minor: 100 }]))
      .toEqual([{ occupancy: 3, rate: 100 }]);
  });
  it("refuses the whole object when nothing is left, rather than sending a rate-less push", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_person", rates: [{ occupancy: 1, minor: 0 }], primaryOccupancy: 1, channelSupportsOccupancy: true });
    expect(r.ok).toBe(false);
  });
  it("skips a null occupancy without dropping its neighbours", () => {
    expect(usableRates([{ occupancy: 1, minor: null }, { occupancy: 2, minor: 12000 }]))
      .toEqual([{ occupancy: 2, rate: 12000 }]);
  });
});

describe("degrading for a single-rate channel", () => {
  it("sends the PRIMARY as a scalar and flags it, rather than dropping the push", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_person", rates, primaryOccupancy: 2, channelSupportsOccupancy: false });
    expect(r.ok && r.value.rate).toBe(12000);
    expect(r.ok && r.value.rates).toBeUndefined();
    expect(r.ok && r.degraded).toBe(true);
  });

  it("does not pick the cheapest — that would undersell every booking", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_person", rates, primaryOccupancy: 3, channelSupportsOccupancy: false });
    expect(r.ok && r.value.rate).toBe(14000);
  });

  it("falls back to the largest occupancy when the primary has no usable rate", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_person", rates: [{ occupancy: 1, minor: 9000 }], primaryOccupancy: 2, channelSupportsOccupancy: false });
    expect(r.ok && r.value.rate).toBe(9000);
  });

  it("is NOT flagged as degraded for a per-room plan — nothing was lost", () => {
    const r = applyRates({ value: { ...base }, sellMode: "per_room", rates: [{ occupancy: 2, minor: 12000 }], primaryOccupancy: 2, channelSupportsOccupancy: false });
    expect(r.ok && r.degraded).toBe(false);
  });
});

describe("toChannexOptions — the plan's shape", () => {
  it("marks exactly one primary", () => {
    const opts = toChannexOptions(rates, 2, 10000);
    expect(opts.filter((o) => o.is_primary)).toHaveLength(1);
    expect(opts.find((o) => o.is_primary)!.occupancy).toBe(2);
  });
  it("moves the primary rather than sending none when the nominated one has no rate", () => {
    const opts = toChannexOptions([{ occupancy: 1, minor: 9000 }], 3, 10000);
    expect(opts.filter((o) => o.is_primary)).toHaveLength(1);
    expect(opts[0]!.occupancy).toBe(1);
  });
  it("is empty when nothing is priced, rather than emitting a zero-rate option", () => {
    expect(toChannexOptions([{ occupancy: 1, minor: 0 }], 1, 500)).toEqual([]);
  });
});

describe("toDerivedOption", () => {
  it("builds the ordered rule Channex expects", () => {
    expect(toDerivedOption("percent", "decrease", 20)).toEqual({ rate: [["decrease_by_percent", "20"]] });
    expect(toDerivedOption("fixed", "increase", 1200)).toEqual({ rate: [["increase_by_amount", "1200"]] });
  });
  it("returns nothing when there is no rule — a manual row is not a derived one", () => {
    expect(toDerivedOption(null, null, null)).toBeUndefined();
    expect(toDerivedOption("percent", "decrease", null)).toBeUndefined();
  });
});

describe("resolveRateMode — the two axes as one Channex field", () => {
  it("no parent is manual", () => {
    expect(resolveRateMode(false, "per_room")).toBe("manual");
    expect(resolveRateMode(false, "per_person")).toBe("manual");
  });
  it("parent + per-room is derived — only the primary follows", () => {
    expect(resolveRateMode(true, "per_room")).toBe("derived");
  });
  it("parent + per-person is CASCADE — every occupancy follows its match", () => {
    // Sending `derived` here derives one occupancy and leaves the rest: the parity failure from
    // inside the plan.
    expect(resolveRateMode(true, "per_person")).toBe("cascade");
  });
});
