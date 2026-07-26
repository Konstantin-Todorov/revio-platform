import { describe, it, expect } from "vitest";
import type { AriUpdate } from "@revio/core";
import {
  toRestrictionValue,
  toAvailabilityValue,
  toRawReservation,
  toRawRevision,
  unsupportedReason,
  type ChannexBooking,
} from "./channex-mappers.js";

const PROP = "prop-uuid";

function ari(overrides: Partial<AriUpdate> = {}): AriUpdate {
  return {
    externalRoomId: "room-uuid",
    externalRateId: "rate-uuid",
    date: "2026-07-01",
    bookable: 5,
    priceMinor: 12000,
    currency: "EUR",
    restrictions: {},
    ...overrides,
  };
}

describe("ARI -> Channex restrictions", () => {
  it("maps rate (minor units) and restriction flags", () => {
    const v = toRestrictionValue(PROP, ari({ restrictions: { minLos: 2, maxLos: 7, cta: true, ctd: false, stopSell: true } }));
    expect(v).toEqual({
      property_id: PROP,
      rate_plan_id: "rate-uuid",
      date: "2026-07-01",
      rate: 12000,
      closed_to_arrival: true,
      closed_to_departure: false,
      stop_sell: true,
      min_stay_arrival: 2,
      min_stay_through: 2,
      max_stay: 7,
    });
  });

  it("omits min/max stay when not set and defaults booleans to false", () => {
    const v = toRestrictionValue(PROP, ari());
    expect(v.min_stay_arrival).toBeUndefined();
    expect(v.min_stay_through).toBeUndefined();
    expect(v.max_stay).toBeUndefined();
    expect(v.stop_sell).toBe(false);
    expect(v.closed_to_arrival).toBe(false);
  });
});

describe("ARI -> Channex availability", () => {
  it("maps bookable count to availability for the room type", () => {
    expect(toAvailabilityValue(PROP, ari({ bookable: 3 }))).toEqual({
      property_id: PROP,
      room_type_id: "room-uuid",
      date: "2026-07-01",
      availability: 3,
    });
  });
});

describe("unsupported restrictions", () => {
  it("flags advance purchase (Channex has no equivalent)", () => {
    expect(unsupportedReason(ari({ restrictions: { advancePurchaseMin: 7 } }))).toMatch(/advance_purchase/);
  });
  it("accepts supported restrictions", () => {
    expect(unsupportedReason(ari({ restrictions: { minLos: 2, stopSell: true } }))).toBeNull();
  });
});

describe("Channex booking -> RawReservation", () => {
  it("unwraps the JSON:API attributes envelope and derives nights from the room days map", () => {
    // Shape returned by the real GET /api/v1/bookings — id at top level, everything else nested.
    const booking: ChannexBooking = {
      id: "booking-uuid",
      attributes: {
        status: "new",
        amount: "240.00",
        currency: "EUR",
        arrival_date: "2026-07-06",
        departure_date: "2026-07-08",
        customer: { name: "Ivan", surname: "Petrov" },
        rooms: [
          {
            room_type_id: "room-uuid",
            rate_plan_id: "rate-uuid",
            amount: "240.00",
            days: { "2026-07-06": "120.00", "2026-07-07": "120.00" },
          },
        ],
      },
    };
    expect(toRawReservation(booking)).toEqual({
      externalId: "booking-uuid",
      guestName: "Ivan Petrov",
      status: "confirmed",
      totalMinor: 24000,
      currency: "EUR",
      lines: [
        // checkout = last night (07-07) + 1 day
        // priceMinor is the sum of the room's own per-night prices — the PMS seeds the guest's
        // folio from it, so losing it means billing the room at zero.
        { externalRoomId: "room-uuid", externalRateId: "rate-uuid", quantity: 1, checkIn: "2026-07-06", checkOut: "2026-07-08", priceMinor: 24000 },
      ],
    });
  });

  it("carries each room's own price, not the booking total, when a booking has several rooms", () => {
    // Regression: the per-line price used to be dropped at this boundary, so an OTA guest checked in
    // with a 0.00 room charge on the folio. With two rooms the booking total is also the wrong
    // number to fall back on — each line must carry its own.
    const r = toRawReservation({
      id: "b-multi",
      attributes: {
        status: "new",
        amount: "300.00",
        currency: "EUR",
        customer: { name: "Ana", surname: "Ivanova" },
        rooms: [
          { room_type_id: "std", rate_plan_id: "bar", days: { "2026-09-01": "100.00" } },
          { room_type_id: "sui", rate_plan_id: "bar", days: { "2026-09-01": "200.00" } },
        ],
      },
    });
    expect(r.totalMinor).toBe(30000);
    expect(r.lines.map((l) => l.priceMinor)).toEqual([10000, 20000]);
  });

  it("omits priceMinor rather than inventing one when the channel sends no per-night prices", () => {
    const r = toRawReservation({
      id: "b-nodays",
      attributes: {
        status: "new", amount: "80.00", currency: "EUR",
        arrival_date: "2026-08-01", departure_date: "2026-08-02",
        customer: { name: "Sam", surname: "Ng" },
        rooms: [{ room_type_id: "r", rate_plan_id: "p" }],
      },
    });
    // Undefined, so the PMS knows to apportion the booking total instead of billing zero.
    expect(r.lines[0]!.priceMinor).toBeUndefined();
  });

  it("falls back to booking-level arrival/departure when a room has no days map", () => {
    const r = toRawReservation({
      id: "b3",
      attributes: {
        status: "new",
        amount: "100.00",
        currency: "EUR",
        arrival_date: "2026-08-01",
        departure_date: "2026-08-02",
        customer: { name: "Sam", surname: "Ng" },
        rooms: [{ room_type_id: "r", rate_plan_id: "p" }],
      },
    });
    expect(r.lines[0]).toMatchObject({ checkIn: "2026-08-01", checkOut: "2026-08-02" });
  });

  it("still accepts a flat (hoisted) shape and falls back on a missing guest name", () => {
    const r = toRawReservation({ id: "b2", status: "cancelled", rooms: [] });
    expect(r.status).toBe("cancelled");
    expect(r.guestName).toBe("Channel Guest");
    expect(r.totalMinor).toBe(0);
  });
});

describe("Channex booking-revision feed -> RawRevision", () => {
  it("keeps the revision id for ack but uses the stable booking id as externalId", () => {
    const rev = toRawRevision({
      id: "revision-uuid",
      attributes: {
        booking_id: "booking-uuid",
        status: "modified",
        amount: "390.00",
        currency: "EUR",
        arrival_date: "2026-07-07",
        departure_date: "2026-07-10",
        customer: { name: "Maria", surname: "Ivanova" },
        rooms: [{ room_type_id: "r", rate_plan_id: "p", days: { "2026-07-07": "130.00", "2026-07-08": "130.00", "2026-07-09": "130.00" } }],
      },
    });
    expect(rev.revisionId).toBe("revision-uuid");
    expect(rev.reservation.externalId).toBe("booking-uuid"); // stable across revisions, NOT the revision id
    expect(rev.reservation.status).toBe("modified");
    expect(rev.reservation.totalMinor).toBe(39000);
    expect(rev.reservation.lines[0]).toMatchObject({ checkIn: "2026-07-07", checkOut: "2026-07-10" });
  });
});
