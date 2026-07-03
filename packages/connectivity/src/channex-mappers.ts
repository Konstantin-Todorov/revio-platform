/**
 * Pure translation between our domain ARI/booking shapes (@revio/core) and the Channex API wire
 * format. Kept HTTP-free so it can be unit-tested without the network — the adapter just does I/O
 * around these functions. Channex API reference: https://docs.channex.io/api-v.1-documentation/ari
 */

import type { AriUpdate, RawReservation } from "@revio/core";

// --- Channex wire types (subset we use) -----------------------------------

/** One row for POST /api/v1/restrictions (rate + restrictions for a rate plan on a date). */
export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date: string;
  rate: number; // minor units, matching Channex's integer rate (e.g. 12000 = 120.00). Verified live.
  // Channex properties don't all support the generic `min_stay`; `min_stay_arrival`/`min_stay_through`
  // are the supported forms (sending `min_stay` triggers a warning and the whole row is rejected).
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  stop_sell: boolean;
}

/** One row for POST /api/v1/availability (room count for a room type on a date). */
export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date: string;
  availability: number;
}

/**
 * A Channex booking as returned by GET /api/v1/bookings — a JSON:API resource: the id sits at the
 * top level and every other field lives under `attributes`. `toRawReservation` tolerates a flat
 * object too (attributes hoisted) so unit tests can pass a plain shape.
 */
export interface ChannexBooking {
  id: string;
  attributes?: ChannexBookingAttributes;
  // Flat fallback (tests / hoisted payloads): attributes may appear inline.
  status?: string;
  amount?: string;
  currency?: string;
  arrival_date?: string;
  departure_date?: string;
  customer?: ChannexCustomer | null;
  rooms?: ChannexBookingRoom[];
}

interface ChannexCustomer {
  name?: string;
  surname?: string;
}

interface ChannexBookingRoom {
  room_type_id: string;
  rate_plan_id: string;
  amount?: string;
  /** Map of stay-night → nightly price, e.g. {"2026-07-06":"120.00"}. Channex omits explicit
   *  check-in/check-out on the room; the nights come from these keys. */
  days?: Record<string, string>;
}

interface ChannexBookingAttributes {
  status?: string; // "new" | "modified" | "cancelled"
  amount?: string; // decimal string, e.g. "240.00"
  currency?: string;
  arrival_date?: string;
  departure_date?: string;
  customer?: ChannexCustomer | null;
  rooms?: ChannexBookingRoom[];
}

/** Add one calendar day to a YYYY-MM-DD string (last stay night → checkout date). */
function nextDay(ymd: string): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}

// --- ARI: domain -> Channex ------------------------------------------------

/**
 * Channex's restrictions endpoint has no advance-purchase concept. If an update relies on it, we
 * surface that as a rejection (Error Center) rather than silently dropping it.
 */
export function unsupportedReason(u: AriUpdate): string | null {
  const r = u.restrictions;
  if (r.advancePurchaseMin != null || r.advancePurchaseMax != null) {
    return "advance_purchase restriction is not supported by Channex";
  }
  return null;
}

export function toRestrictionValue(propertyId: string, u: AriUpdate): ChannexRestrictionValue {
  const r = u.restrictions;
  const value: ChannexRestrictionValue = {
    property_id: propertyId,
    rate_plan_id: u.externalRateId,
    date: u.date,
    rate: u.priceMinor,
    closed_to_arrival: r.cta ?? false,
    closed_to_departure: r.ctd ?? false,
    stop_sell: r.stopSell ?? false,
  };
  if (r.minLos != null) {
    value.min_stay_arrival = r.minLos;
    value.min_stay_through = r.minLos;
  }
  if (r.maxLos != null) value.max_stay = r.maxLos;
  return value;
}

export function toAvailabilityValue(propertyId: string, u: AriUpdate): ChannexAvailabilityValue {
  return {
    property_id: propertyId,
    room_type_id: u.externalRoomId,
    date: u.date,
    availability: u.bookable,
  };
}

// --- Booking: Channex -> domain -------------------------------------------

const STATUS_MAP: Record<string, RawReservation["status"]> = {
  new: "confirmed",
  modified: "modified",
  cancelled: "cancelled",
};

export function toRawReservation(b: ChannexBooking): RawReservation {
  // Unwrap the JSON:API envelope: real responses nest everything under `attributes`; tests may
  // pass a flat object. The id always stays at the top level.
  const a: ChannexBookingAttributes = b.attributes ?? b;
  const name = [a.customer?.name, a.customer?.surname].filter(Boolean).join(" ").trim();
  return {
    externalId: b.id,
    guestName: name || "Channel Guest",
    status: STATUS_MAP[a.status ?? ""] ?? "confirmed",
    lines: (a.rooms ?? []).map((room) => {
      const nights = Object.keys(room.days ?? {}).sort();
      const checkIn = nights[0] ?? a.arrival_date ?? "";
      const checkOut = nights.length ? nextDay(nights[nights.length - 1]!) : (a.departure_date ?? "");
      return {
        externalRoomId: room.room_type_id,
        externalRateId: room.rate_plan_id,
        quantity: 1,
        checkIn,
        checkOut,
      };
    }),
    totalMinor: a.amount != null ? Math.round(Number(a.amount) * 100) : 0,
    currency: a.currency ?? "EUR",
  };
}
