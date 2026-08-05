import { describe, expect, it } from "vitest";
import { channelEconomics, isCommissionFreeCategory, type ChannelRevenueLine } from "./channel-economics.js";

const line = (o: Partial<ChannelRevenueLine> & { sourceName: string; category: string }): ChannelRevenueLine => ({
  commissionPct: null,
  revenueMinor: 0,
  roomNights: 0,
  reservations: 0,
  ...o,
});

describe("channelEconomics", () => {
  it("counts commission actually paid, per channel's own rate", () => {
    const e = channelEconomics([
      line({ sourceName: "Booking.com", category: "ota", commissionPct: 15, revenueMinor: 100_000 }),
      line({ sourceName: "Expedia", category: "ota", commissionPct: 20, revenueMinor: 50_000 }),
    ]);
    // 15% of 1000.00 + 20% of 500.00 = 150.00 + 100.00
    expect(e.commissionPaidMinor).toBe(25_000);
    expect(e.otaRevenueMinor).toBe(150_000);
    expect(e.netOfCommissionMinor).toBe(125_000);
  });

  it("weights the blended rate by revenue, not by channel count", () => {
    const e = channelEconomics([
      line({ sourceName: "Cheap", category: "ota", commissionPct: 10, revenueMinor: 900_000 }),
      line({ sourceName: "Dear", category: "ota", commissionPct: 25, revenueMinor: 100_000 }),
    ]);
    // A naive mean of the two rates is 17.5%. The revenue-weighted rate is 11.5%, and a hotel
    // selling almost everything through the cheap channel does not face 17.5%.
    expect(e.blendedOtaRatePct).toBeCloseTo(11.5, 6);
  });

  it("treats direct revenue as commission-free and reports its share", () => {
    const e = channelEconomics([
      line({ sourceName: "Booking Engine", category: "direct", revenueMinor: 40_000 }),
      line({ sourceName: "Booking.com", category: "ota", commissionPct: 15, revenueMinor: 60_000 }),
    ]);
    expect(e.directRevenueMinor).toBe(40_000);
    expect(e.directSharePct).toBeCloseTo(40, 6);
    expect(e.rows.find((r) => r.sourceName === "Booking Engine")!.commissionMinor).toBe(0);
  });

  it("estimates avoided commission from the hotel's OWN blended rate", () => {
    const e = channelEconomics([
      line({ sourceName: "Booking Engine", category: "direct", revenueMinor: 200_000 }),
      line({ sourceName: "Booking.com", category: "ota", commissionPct: 18, revenueMinor: 100_000 }),
    ]);
    expect(e.blendedOtaRatePct).toBeCloseTo(18, 6);
    expect(e.commissionAvoidedMinor).toBe(36_000); // 18% of 2000.00
  });

  it("returns null — not zero — for avoided commission when there is no OTA revenue", () => {
    // The headline number is unknowable here, and a hotel with no OTA channels must not be shown a
    // saving invented from an industry average. Null is the only honest answer.
    const e = channelEconomics([
      line({ sourceName: "Booking Engine", category: "direct", revenueMinor: 500_000 }),
    ]);
    expect(e.blendedOtaRatePct).toBeNull();
    expect(e.commissionAvoidedMinor).toBeNull();
    expect(e.directSharePct).toBeCloseTo(100, 6);
  });

  it("does not let an unknown rate drag the blended rate down", () => {
    // A channel with no configured rate contributes revenue but no commission. If it were allowed to
    // weight the average, the hotel's real cost of distribution would read lower than it is.
    const e = channelEconomics([
      line({ sourceName: "Known", category: "ota", commissionPct: 20, revenueMinor: 100_000 }),
      line({ sourceName: "Unmapped", category: "ota", commissionPct: null, revenueMinor: 100_000 }),
    ]);
    expect(e.blendedOtaRatePct).toBeCloseTo(20, 6);
    expect(e.commissionPaidMinor).toBe(20_000);
    expect(e.rows.find((r) => r.sourceName === "Unmapped")!.commissionMinor).toBeNull();
  });

  it("keeps corporate and travel-agent revenue out of both buckets", () => {
    // Neither commission-free nor OTA. Folding them into "direct" would inflate the number the
    // booking engine is judged on.
    const e = channelEconomics([
      line({ sourceName: "Acme Corp", category: "corporate", revenueMinor: 30_000 }),
      line({ sourceName: "Booking Engine", category: "direct", revenueMinor: 70_000 }),
    ]);
    expect(e.otherRevenueMinor).toBe(30_000);
    expect(e.directRevenueMinor).toBe(70_000);
    expect(e.directSharePct).toBeCloseTo(70, 6);
  });

  it("counts the call centre as direct — the hotel took the booking itself", () => {
    const e = channelEconomics([
      line({ sourceName: "Phone", category: "call_center", revenueMinor: 10_000 }),
    ]);
    expect(e.directRevenueMinor).toBe(10_000);
  });

  it("survives an empty period without dividing by zero", () => {
    const e = channelEconomics([]);
    expect(e.totalRevenueMinor).toBe(0);
    expect(e.directSharePct).toBe(0);
    expect(e.commissionPaidMinor).toBe(0);
    expect(e.commissionAvoidedMinor).toBeNull();
    expect(e.rows).toEqual([]);
  });

  it("stays in integer minor units", () => {
    // 33.33% of 1000.33 would be fractional cents. Money is integers everywhere in this codebase.
    const e = channelEconomics([
      line({ sourceName: "Odd", category: "ota", commissionPct: 33.33, revenueMinor: 100_033 }),
    ]);
    expect(Number.isInteger(e.commissionPaidMinor)).toBe(true);
    expect(e.commissionPaidMinor).toBe(33_341);
  });

  it("distinguishes commission-free-by-nature from cost-nothing-this-period", () => {
    // Caught in the browser: an OTA row with no revenue computes to zero commission, and a UI that
    // read "is it zero?" rendered it with the green commission-free badge — telling a hotel that
    // selling through Booking.com is free. The category is the only thing that separates the two,
    // which is why `isCommissionFreeCategory` is exported rather than re-derived at the call site.
    const e = channelEconomics([
      line({ sourceName: "Idle OTA", category: "ota", commissionPct: 15, revenueMinor: 0 }),
      line({ sourceName: "Booking Engine", category: "direct", revenueMinor: 0 }),
    ]);
    const idle = e.rows.find((r) => r.sourceName === "Idle OTA")!;
    const direct = e.rows.find((r) => r.sourceName === "Booking Engine")!;
    expect(idle.commissionMinor).toBe(0);
    expect(direct.commissionMinor).toBe(0); // identical numbers…
    expect(isCommissionFreeCategory(idle.category)).toBe(false); // …but not identical facts
    expect(isCommissionFreeCategory(direct.category)).toBe(true);
  });

  it("ranks rows by revenue so the biggest dependency reads first", () => {
    const e = channelEconomics([
      line({ sourceName: "Small", category: "ota", commissionPct: 15, revenueMinor: 1_000 }),
      line({ sourceName: "Big", category: "ota", commissionPct: 15, revenueMinor: 90_000 }),
      line({ sourceName: "Mid", category: "direct", revenueMinor: 20_000 }),
    ]);
    expect(e.rows.map((r) => r.sourceName)).toEqual(["Big", "Mid", "Small"]);
  });
});
