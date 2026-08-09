import { describe, it, expect } from "vitest";
import type { AriUpdate } from "@revio/core";
import {
  toRestrictionValue,
  toAvailabilityValue,
  mergeDateRanges,
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

/**
 * An update that is NOT changing the rate — the key is absent, not set to undefined.
 * Under `exactOptionalPropertyTypes` those are different things, and the distinction is the whole
 * point of this change: absent means "leave it alone".
 */
function ariNoRate(restrictions: AriUpdate["restrictions"] = {}): AriUpdate {
  const { priceMinor: _notChanging, ...rest } = ari({ restrictions });
  return rest;
}

describe("ARI -> Channex restrictions", () => {
  it("maps rate (minor units) and restriction flags", () => {
    const v = toRestrictionValue(PROP, ari({ restrictions: { minLos: 2, maxLos: 7, cta: true, ctd: false, stopSell: true } }))!;
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

  // The test that used to live here asserted `stop_sell: false` and `closed_to_arrival: false` on an
  // update that set neither — it pinned the exact behaviour Channex rejected ("update should contain
  // only rates"), and worse, the behaviour that silently cleared restrictions set elsewhere. A test
  // can hold a bug in place as firmly as it holds a feature.

  it("sends ONLY the fields the update actually set", () => {
    const v = toRestrictionValue(PROP, ari({ restrictions: {} }))!;
    expect(v).toEqual({ property_id: PROP, rate_plan_id: "rate-uuid", date: "2026-07-01", rate: 12000 });
    expect("stop_sell" in v).toBe(false);
    expect("closed_to_arrival" in v).toBe(false);
    expect("closed_to_departure" in v).toBe(false);
  });

  it("sends a restriction-only update with no rate attached", () => {
    // Channex test 6: a stop-sell update must contain stop sell and nothing else.
    const v = toRestrictionValue(PROP, ariNoRate({ stopSell: true }))!;
    expect(v).toEqual({ property_id: PROP, rate_plan_id: "rate-uuid", date: "2026-07-01", stop_sell: true });
  });

  it("keeps an explicit false — turning a restriction OFF is a real instruction", () => {
    // The distinction the old code destroyed: `undefined` means "not touching it", `false` means
    // "clear it". Collapsing both to false is what made every rate push destructive.
    const v = toRestrictionValue(PROP, ariNoRate({ stopSell: false }))!;
    expect(v.stop_sell).toBe(false);
  });

  it("returns null when there is nothing to say on this endpoint", () => {
    // An availability-only edit. Posting identity with no values would read as "clear everything".
    expect(toRestrictionValue(PROP, ariNoRate())).toBeNull();
  });

  it("sends max_stay when set — declared support has to be real support", () => {
    // 2000/2000 objects were missing this at certification because the caller never set it.
    const v = toRestrictionValue(PROP, ariNoRate({ maxLos: 4 }))!;
    expect(v.max_stay).toBe(4);
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

describe("mergeDateRanges", () => {
  const row = (date: string, extra: Record<string, unknown> = {}) => ({ property_id: PROP, rate_plan_id: "r1", date, rate: 24100, ...extra });

  it("collapses a consecutive run into one date_range object", () => {
    // Channex: "use date_range syntax with merged sequences instead of single-date objects".
    // Ten identical days become one object, not ten.
    const days = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((d) => row(`2026-11-${d}`));
    expect(mergeDateRanges(days)).toEqual([
      { property_id: PROP, rate_plan_id: "r1", rate: 24100, date_from: "2026-11-01", date_to: "2026-11-10" },
    ]);
  });

  it("keeps a single day as `date`, not a one-day range", () => {
    expect(mergeDateRanges([row("2026-11-22")])).toEqual([row("2026-11-22")]);
  });

  it("does NOT merge across a gap — a skipped day must stay skipped", () => {
    // Merging 1-2 and 4-5 into 1-5 would assert a rate on the 3rd that nobody set.
    const out = mergeDateRanges([row("2026-11-01"), row("2026-11-02"), row("2026-11-04"), row("2026-11-05")]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ date_from: "2026-11-01", date_to: "2026-11-02" });
    expect(out[1]).toMatchObject({ date_from: "2026-11-04", date_to: "2026-11-05" });
  });

  it("does not merge adjacent days carrying DIFFERENT values", () => {
    const out = mergeDateRanges([row("2026-11-01"), row("2026-11-02", { rate: 31266 })]);
    expect(out).toHaveLength(2);
  });

  it("merges each rate plan independently", () => {
    const out = mergeDateRanges([
      { property_id: PROP, rate_plan_id: "twin-bar", date: "2026-11-01", rate: 24100 },
      { property_id: PROP, rate_plan_id: "twin-bar", date: "2026-11-02", rate: 24100 },
      { property_id: PROP, rate_plan_id: "double-bar", date: "2026-11-01", rate: 31266 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((v) => v.rate_plan_id === "double-bar")).toMatchObject({ date: "2026-11-01" });
  });

  it("crosses a month boundary — 30 Nov and 1 Dec are consecutive", () => {
    const out = mergeDateRanges([row("2026-11-30"), row("2026-12-01")]);
    expect(out).toEqual([{ property_id: PROP, rate_plan_id: "r1", rate: 24100, date_from: "2026-11-30", date_to: "2026-12-01" }]);
  });

  it("is not confused by field ORDER — the same payload groups together", () => {
    const out = mergeDateRanges([
      { property_id: PROP, rate_plan_id: "r1", date: "2026-11-01", rate: 100, stop_sell: true },
      { stop_sell: true, rate: 100, date: "2026-11-02", rate_plan_id: "r1", property_id: PROP },
    ]);
    expect(out).toHaveLength(1);
  });

  it("de-duplicates a repeated date rather than breaking the run", () => {
    expect(mergeDateRanges([row("2026-11-01"), row("2026-11-01"), row("2026-11-02")])).toHaveLength(1);
  });

  it("handles a half-year in one object — the shape Channex wants for test 8", () => {
    const days: ReturnType<typeof row>[] = [];
    for (let d = new Date(Date.UTC(2026, 11, 1)); d <= new Date(Date.UTC(2027, 4, 1)); d = new Date(d.getTime() + 86400000)) {
      days.push(row(d.toISOString().slice(0, 10)));
    }
    expect(days.length).toBeGreaterThan(150);
    expect(mergeDateRanges(days)).toEqual([
      { property_id: PROP, rate_plan_id: "r1", rate: 24100, date_from: "2026-12-01", date_to: "2027-05-01" },
    ]);
  });
});
