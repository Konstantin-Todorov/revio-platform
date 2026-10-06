import { describe, expect, it } from "vitest";
import { computeStayCharges } from "@revio/core";
import { addedNights, extensionMode, feeDelta, spreadTotal, stayShapeOf } from "./extend-stay";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("extensionMode", () => {
  it("extends a direct or phone booking in place", () => {
    expect(extensionMode({ channelId: null, paymentGuarantee: "card_on_file" }, 1)).toBe("extend");
    expect(extensionMode({ channelId: null, paymentGuarantee: null }, 1)).toBe("extend");
  });
  it("never edits a channel's booking — the extra nights are a linked reservation", () => {
    expect(extensionMode({ channelId: "ch_booking", paymentGuarantee: null }, 1)).toBe("linked");
    expect(extensionMode({ channelId: null, paymentGuarantee: "prepaid_ota" }, 1)).toBe("linked");
  });
  it("does not stretch every room of a multi-room line for one guest", () => {
    expect(extensionMode({ channelId: null, paymentGuarantee: null }, 2)).toBe("linked");
  });
});

describe("addedNights", () => {
  it("lists the nights between the old and the new departure", () => {
    expect(addedNights("2026-10-08", "2026-10-10")).toEqual(["2026-10-08", "2026-10-09"]);
  });
  it("crosses a month end and the DST change", () => {
    expect(addedNights("2026-10-24", "2026-10-27")).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(addedNights("2026-10-31", "2026-11-02")).toEqual(["2026-10-31", "2026-11-01"]);
  });
  it("adds nothing when the date does not move forward", () => {
    expect(addedNights("2026-10-08", "2026-10-08")).toEqual([]);
    expect(addedNights("2026-10-08", "2026-10-06")).toEqual([]);
  });
});

describe("spreadTotal", () => {
  it("keeps the quote's shape and sums to exactly what was typed", () => {
    const parts = spreadTotal([10000, 12000, 12000], 30000);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(30000);
    expect(parts[1]).toBeGreaterThan(parts[0]!);
  });
  it("returns the quote unchanged when the total was not edited", () => {
    expect(spreadTotal([9000, 11000], 20000)).toEqual([9000, 11000]);
  });
  it("splits evenly when nothing was quoted", () => {
    expect(spreadTotal([0, 0, 0], 10000)).toEqual([3333, 3333, 3334]);
  });
  it("never loses a cent to rounding", () => {
    for (const total of [1, 7, 9999, 12345, 100001]) {
      expect(spreadTotal([3333, 4444, 5555, 1], total).reduce((s, p) => s + p, 0)).toBe(total);
    }
  });
});

describe("feeDelta through the real fee engine", () => {
  const fees = [
    { name: "City tax", type: "fixed", amountMinor: 150, basis: "per_person_night", inclusion: "excluded" },
    { name: "Cleaning", type: "fixed", amountMinor: 2000, basis: "per_stay", inclusion: "excluded" },
    { name: "Service", type: "percent", pct: 10, amountMinor: null, basis: "per_stay", inclusion: "excluded" },
  ];
  const line = { quantity: 1, guestsCount: 2, childrenCount: 1, infantsCount: 0 };

  it("adds the tourist tax for the new nights only, nothing per stay, and its share of a percentage", () => {
    const before = computeStayCharges({ stay: stayShapeOf([{ ...line, checkIn: d("2026-10-05"), checkOut: d("2026-10-08") }], 30000), fees });
    const after = computeStayCharges({ stay: stayShapeOf([{ ...line, checkIn: d("2026-10-05"), checkOut: d("2026-10-10") }], 50000), fees });
    const delta = feeDelta(before.lines, after.lines);
    // 3 people × 2 new nights × 1.50
    expect(delta.find((l) => l.name === "City tax")?.amountMinor).toBe(900);
    expect(delta.find((l) => l.name === "Cleaning")).toBeUndefined();
    expect(delta.find((l) => l.name === "Service")?.amountMinor).toBe(2000);
  });

  it("stays silent when the tourist tax is in the rate", () => {
    const before = computeStayCharges({ stay: stayShapeOf([{ ...line, checkIn: d("2026-10-05"), checkOut: d("2026-10-08") }], 30000), fees, cityTaxIncluded: true });
    const after = computeStayCharges({ stay: stayShapeOf([{ ...line, checkIn: d("2026-10-05"), checkOut: d("2026-10-10") }], 50000), fees, cityTaxIncluded: true });
    expect(feeDelta(before.lines, after.lines).some((l) => l.name === "City tax")).toBe(false);
  });
});

describe("stayShapeOf", () => {
  it("counts everyone who sleeps there for the tourist tax, adults only for the rate", () => {
    const s = stayShapeOf([{ checkIn: d("2026-10-05"), checkOut: d("2026-10-08"), quantity: 1, guestsCount: 2, childrenCount: 1, infantsCount: 1 }], 100);
    expect(s).toEqual({ accommodationMinor: 100, nights: 3, rooms: 1, guests: 2, persons: 4 });
  });
});
