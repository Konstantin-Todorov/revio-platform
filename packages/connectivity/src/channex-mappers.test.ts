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
      min_stay: 2,
      max_stay: 7,
    });
  });

  it("omits min/max stay when not set and defaults booleans to false", () => {
    const v = toRestrictionValue(PROP, ari());
    expect(v.min_stay).toBeUndefined();
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
  it("maps status, guest, rooms->lines, and amount to minor units", () => {
    const booking: ChannexBooking = {
      id: "booking-uuid",
      unique_id: "BDC-123",
      status: "new",
      amount: "220.00",
      currency: "GBP",
      customer: { name: "Ada", surname: "Lovelace" },
      rooms: [
        { room_type_id: "room-uuid", rate_plan_id: "rate-uuid", checkin_date: "2026-07-01", checkout_date: "2026-07-03" },
      ],
    };
    expect(toRawReservation(booking)).toEqual({
      externalId: "booking-uuid",
      guestName: "Ada Lovelace",
      status: "confirmed",
      totalMinor: 22000,
      currency: "GBP",
      lines: [
        { externalRoomId: "room-uuid", externalRateId: "rate-uuid", quantity: 1, checkIn: "2026-07-01", checkOut: "2026-07-03" },
      ],
    });
  });

  it("maps cancelled status and falls back on a missing guest name", () => {
    const r = toRawReservation({ id: "b2", status: "cancelled", rooms: [] });
    expect(r.status).toBe("cancelled");
    expect(r.guestName).toBe("Channel Guest");
    expect(r.totalMinor).toBe(0);
  });
});
