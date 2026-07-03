import { describe, it, expect } from "vitest";
import type { AriUpdate } from "@revio/core";
import {
  toRestrictionValue,
  toAvailabilityValue,
  toRawReservation,
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
        { externalRoomId: "room-uuid", externalRateId: "rate-uuid", quantity: 1, checkIn: "2026-07-06", checkOut: "2026-07-08" },
      ],
    });
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
