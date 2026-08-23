import { describe, it, expect } from "vitest";
import { assessMove, describeAccommodation, moveRequiresDistributionPush, type MoveNight } from "./move.js";

/** A 3-night stay booked at 100.00/night, where the destination type costs 130.00/night. */
const nights: MoveNight[] = [
  { date: "2026-08-24", bookedMinor: 10000, destinationMinor: 13000 },
  { date: "2026-08-25", bookedMinor: 10000, destinationMinor: 13000 },
  { date: "2026-08-26", bookedMinor: 10000, destinationMinor: 13000 },
];

describe("assessMove — same room type", () => {
  it("is operational, with nothing to price", () => {
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "double",
      stayNights: nights, effectiveFrom: "2026-08-24",
    });
    expect(m.kind).toBe("operational");
    expect(m.differenceMinor).toBe(0);
    expect(m.options).toEqual([]);
  });

  it("offers no resolutions to click — there is no money question", () => {
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "double",
      stayNights: nights, effectiveFrom: "2026-08-25",
    });
    expect(m.options).toHaveLength(0);
  });
});

describe("assessMove — across room types", () => {
  it("prices an arrival-day move across the whole stay", () => {
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "deluxe",
      stayNights: nights, effectiveFrom: "2026-08-24",
    });
    expect(m.kind).toBe("rate_affecting");
    expect(m.nights).toHaveLength(3);
    expect(m.differenceMinor).toBe(9000); // 3 × 30.00
    expect(m.direction).toBe("upgrade");
  });

  it("prices a mid-stay move only over the nights not yet slept", () => {
    // The guest already slept the 24th in the old room and was charged correctly for it. Re-rating
    // it would rewrite history to match a decision taken afterwards.
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "deluxe",
      stayNights: nights, effectiveFrom: "2026-08-25",
    });
    expect(m.nights).toEqual(["2026-08-25", "2026-08-26"]);
    expect(m.differenceMinor).toBe(6000);
  });

  it("offers comp / charge / custom on an upgrade — never refund", () => {
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "deluxe",
      stayNights: nights, effectiveFrom: "2026-08-24",
    });
    expect(m.options).toEqual(["comp", "charge", "custom"]);
    expect(m.options).not.toContain("refund");
  });

  it("offers refund / waive / custom on a downgrade — never charge", () => {
    const down = nights.map((n) => ({ ...n, destinationMinor: 7000 }));
    const m = assessMove({
      bookedRoomTypeId: "deluxe", destinationRoomTypeId: "double",
      stayNights: down, effectiveFrom: "2026-08-24",
    });
    expect(m.direction).toBe("downgrade");
    expect(m.differenceMinor).toBe(-9000);
    expect(m.options).toEqual(["refund", "waive", "custom"]);
    expect(m.options).not.toContain("charge");
  });

  it("is still rate-affecting when the two types happen to cost the same", () => {
    // Same price today does not make it the same product, and the record must still show the guest
    // was accommodated in something other than what they bought.
    const even = nights.map((n) => ({ ...n, destinationMinor: n.bookedMinor }));
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "deluxe",
      stayNights: even, effectiveFrom: "2026-08-24",
    });
    expect(m.kind).toBe("rate_affecting");
    expect(m.direction).toBe("even");
    expect(m.differenceMinor).toBe(0);
  });

  it("prices nothing when the move takes effect after the last night", () => {
    const m = assessMove({
      bookedRoomTypeId: "double", destinationRoomTypeId: "deluxe",
      stayNights: nights, effectiveFrom: "2026-09-01",
    });
    expect(m.nights).toEqual([]);
    expect(m.differenceMinor).toBe(0);
  });
});

describe("the CRS boundary", () => {
  it("records both facts — what was sold and where they slept", () => {
    expect(describeAccommodation({
      bookedRoomTypeName: "Standard Double",
      bookedUnitLabel: null,
      accommodatedRoomTypeName: "Deluxe Double",
      accommodatedUnitLabel: "305",
    })).toBe("Original room type booked: Standard Double (room —). Accommodated in: Deluxe Double, room 305.");
  });

  it("a front-desk move is never a distribution event", () => {
    // The CRS sold a Standard and decremented Standard availability. Pushing a change here would
    // tell Booking.com something that is not true of what was sold.
    expect(moveRequiresDistributionPush()).toBe(false);
  });
});
