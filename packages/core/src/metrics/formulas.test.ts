import { describe, expect, it } from "vitest";
import {
  adrMinor, averageLeadTimeDays, averageLosNights, cancellationRatePct,
  cancelledRoomNightRatePct, nightsInRange, occupancyPct, pickup, revparMinor,
  soldStatusesFor, stayTotals,
} from "./formulas.js";

const RANGE = { start: "2026-07-01", endExcl: "2026-07-08" }; // 7 nights

describe("formula sheet", () => {
  it("clips nights to the range from both sides", () => {
    expect(nightsInRange("2026-06-29", "2026-07-03", RANGE)).toBe(2); // 01,02
    expect(nightsInRange("2026-07-06", "2026-07-12", RANGE)).toBe(2); // 06,07
    expect(nightsInRange("2026-07-02", "2026-07-04", RANGE)).toBe(2);
    expect(nightsInRange("2026-06-01", "2026-06-05", RANGE)).toBe(0);
  });

  it("computes room-nights and prorated revenue (2 rooms × 3 nights = 6 room-nights)", () => {
    const totals = stayTotals(
      [{ status: "confirmed", quantity: 2, checkIn: "2026-07-02", checkOut: "2026-07-05", priceMinor: 60000 }],
      RANGE,
      { countNoShows: true },
    );
    expect(totals.roomsSoldNights).toBe(6);
    expect(totals.roomRevenueMinor).toBe(60000); // fully inside the range
  });

  it("prorates revenue when a stay straddles the range edge", () => {
    const totals = stayTotals(
      [{ status: "confirmed", quantity: 1, checkIn: "2026-06-29", checkOut: "2026-07-03", priceMinor: 40000 }],
      RANGE,
      { countNoShows: true },
    );
    expect(totals.roomsSoldNights).toBe(2); // of 4 nights, 2 in range
    expect(totals.roomRevenueMinor).toBe(20000);
  });

  it("no-shows count as sold by default, excluded when toggled off", () => {
    const lines = [{ status: "no_show", quantity: 1, checkIn: "2026-07-01", checkOut: "2026-07-02", priceMinor: 10000 }];
    expect(stayTotals(lines, RANGE, { countNoShows: true }).roomsSoldNights).toBe(1);
    expect(stayTotals(lines, RANGE, { countNoShows: false }).roomsSoldNights).toBe(0);
    expect(soldStatusesFor(false)).not.toContain("no_show");
  });

  it("net revenue subtracts the channel commission", () => {
    const totals = stayTotals(
      [{ status: "confirmed", quantity: 1, checkIn: "2026-07-01", checkOut: "2026-07-03", priceMinor: 20000, commissionPct: 15 }],
      RANGE,
      { countNoShows: true },
    );
    expect(totals.roomRevenueMinor).toBe(20000);
    expect(totals.netRevenueMinor).toBe(17000);
  });

  it("cancelled stays produce no sold nights or revenue", () => {
    const totals = stayTotals(
      [{ status: "cancelled", quantity: 3, checkIn: "2026-07-01", checkOut: "2026-07-05", priceMinor: 90000 }],
      RANGE,
      { countNoShows: true },
    );
    expect(totals).toEqual({ roomsSoldNights: 0, roomRevenueMinor: 0, netRevenueMinor: 0 });
  });

  it("occupancy / ADR / RevPAR agree (RevPAR = ADR × occupancy)", () => {
    const sold = 35, available = 48 * 7, revenue = 420000;
    const occ = occupancyPct(sold, available);
    const adr = adrMinor(revenue, sold);
    const revpar = revparMinor(revenue, available);
    expect(occ).toBeCloseTo(10.4167, 3);
    expect(adr).toBe(12000);
    expect(revpar).toBe(Math.round((adr * occ) / 100));
  });

  it("division-by-zero yields 0 everywhere", () => {
    expect(occupancyPct(5, 0)).toBe(0);
    expect(adrMinor(100, 0)).toBe(0);
    expect(revparMinor(100, 0)).toBe(0);
    expect(cancellationRatePct(1, 0)).toBe(0);
    expect(averageLosNights(10, 0)).toBe(0);
  });

  it("cancellation rates: headline counts reservations, report weights room-nights", () => {
    expect(cancellationRatePct(2, 10)).toBe(20);
    expect(cancelledRoomNightRatePct(6, 60)).toBe(10);
  });

  it("LOS, lead time and pickup", () => {
    expect(averageLosNights(12, 4)).toBe(3);
    expect(averageLeadTimeDays([["2026-07-01", "2026-07-11"], ["2026-07-01", "2026-07-21"]])).toBe(15);
    expect(pickup(42, 35)).toBe(7);
  });
});
