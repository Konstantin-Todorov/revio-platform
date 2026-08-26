/**
 * Pure translation between our domain ARI/booking shapes (@revio/core) and the Channex API wire
 * format. Kept HTTP-free so it can be unit-tested without the network — the adapter just does I/O
 * around these functions. Channex API reference: https://docs.channex.io/api-v.1-documentation/ari
 */

import type { AriUpdate, RawReservation, RawRevision } from "@revio/core";

// --- Channex wire types (subset we use) -----------------------------------

/**
 * One row for POST /api/v1/restrictions (rate and/or restrictions for a rate plan on a date).
 *
 * **Every value field is optional, and that is load-bearing.** These used to be mandatory, so
 * `toRestrictionValue` filled the gaps with `?? false` and every rate change shipped
 * `stop_sell: false, closed_to_arrival: false, closed_to_departure: false` alongside it. Channex
 * rejected that during certification — "update should contain only rates" — and it was worse than a
 * failed test: a channel takes each field as an instruction, so every price edit silently cleared
 * restrictions somebody had set elsewhere, including in the channel's own extranet.
 *
 * `date` OR `date_from`/`date_to` — see `mergeDateRanges`.
 */
export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  rate?: number; // minor units, matching Channex's integer rate (e.g. 12000 = 120.00). Verified live.
  // Channex properties don't all support the generic `min_stay`; `min_stay_arrival`/`min_stay_through`
  // are the supported forms (sending `min_stay` triggers a warning and the whole row is rejected).
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
}

/** One row for POST /api/v1/availability (room count for a room type on a date). */
export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date?: string;
  date_from?: string;
  date_to?: string;
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
  /** On a booking-revision feed item: the stable booking id (revision id is the resource id). */
  booking_id?: string;
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
  /*
   * Channex requires a rate > 0, and rejects a zero or negative one per-object — inside an HTTP 200,
   * as a warning. We now parse those, so it would surface either way; catching it here surfaces it
   * BEFORE the call, against the specific cell, and without spending a request to be told.
   *
   * A zero rate is also almost never what somebody meant. It reaches here from an empty price field
   * or an over-enthusiastic percentage decrease, and "the channel refused this" is a better answer
   * than a room quietly listed at nothing.
   */
  if (u.priceMinor != null && u.priceMinor <= 0) {
    return `rate must be greater than zero (got ${u.priceMinor / 100})`;
  }
  return null;
}

/**
 * Rate + restrictions for one date, carrying **only the fields the caller actually set**.
 *
 * Returns `null` when an update changes nothing on this endpoint (an availability-only edit), so the
 * caller drops it rather than posting a row that says "and by the way, clear every restriction".
 */
export function toRestrictionValue(propertyId: string, u: AriUpdate): ChannexRestrictionValue | null {
  const r = u.restrictions;
  const value: ChannexRestrictionValue = {
    property_id: propertyId,
    rate_plan_id: u.externalRateId,
    date: u.date,
  };
  if (u.priceMinor != null) value.rate = u.priceMinor;
  if (r.minLos != null) {
    value.min_stay_arrival = r.minLos;
    value.min_stay_through = r.minLos;
  }
  if (r.maxLos != null) value.max_stay = r.maxLos;
  if (r.cta != null) value.closed_to_arrival = r.cta;
  if (r.ctd != null) value.closed_to_departure = r.ctd;
  if (r.stopSell != null) value.stop_sell = r.stopSell;

  // property_id + rate_plan_id + date are identity, not instruction. Nothing else set = nothing to say.
  return Object.keys(value).length > 3 ? value : null;
}

/** Availability for one date, or `null` when the update is not changing availability. */
export function toAvailabilityValue(propertyId: string, u: AriUpdate): ChannexAvailabilityValue | null {
  if (u.bookable == null) return null;
  return {
    property_id: propertyId,
    room_type_id: u.externalRoomId,
    date: u.date,
    availability: u.bookable,
  };
}

/**
 * Collapse runs of consecutive dates carrying identical values into Channex's `date_from`/`date_to`
 * form. Channex asks for this explicitly ("use date_range syntax with merged sequences instead of
 * single-date objects") and it is the difference between 500 objects and one for a half-year push.
 *
 * Only *adjacent* days merge: a gap must stay a gap, or the payload would assert a value on dates the
 * caller deliberately skipped. Single days keep `date` rather than a one-day range, which is what
 * Channex's own examples show.
 */
export function mergeDateRanges<T extends { date?: string }>(values: T[]): T[] {
  const groups = new Map<string, { rest: Omit<T, "date">; dates: string[] }>();
  for (const v of values) {
    const { date, ...rest } = v;
    if (!date) continue;
    // Key on the payload minus the date, with sorted keys so field order never splits a group.
    const key = JSON.stringify(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)));
    const g = groups.get(key);
    if (g) g.dates.push(date);
    else groups.set(key, { rest: rest as Omit<T, "date">, dates: [date] });
  }

  const out: T[] = [];
  for (const { rest, dates } of groups.values()) {
    const sorted = [...new Set(dates)].sort();
    // From 1: the break test compares each day with the one before it, so index 0 has nothing to
    // compare against. Ending at length closes the final run.
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && isNextDay(sorted[i - 1]!, sorted[i]!)) continue;
      const from = sorted[runStart]!;
      const to = sorted[i - 1]!;
      out.push((from === to ? { ...rest, date: from } : { ...rest, date_from: from, date_to: to }) as T);
      runStart = i;
    }
  }
  return out;
}

function isNextDay(prev: string, next: string): boolean {
  return nextDay(prev) === next;
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
      // Channex gives each room a per-night price map; the room's stay total is their sum. Carry it
      // so the PMS can bill the guest — the booking's overall `amount` can cover several rooms.
      const perNight = Object.values(room.days ?? {}).map((v) => Number(v)).filter((n) => Number.isFinite(n));
      const priceMinor = perNight.length ? Math.round(perNight.reduce((a, b) => a + b, 0) * 100) : undefined;
      return {
        externalRoomId: room.room_type_id,
        externalRateId: room.rate_plan_id,
        quantity: 1,
        checkIn,
        checkOut,
        ...(priceMinor != null ? { priceMinor } : {}),
      };
    }),
    totalMinor: a.amount != null ? Math.round(Number(a.amount) * 100) : 0,
    currency: a.currency ?? "EUR",
  };
}

/**
 * Map a booking-revisions feed item → { revisionId, reservation }. The revision's resource id is the
 * ack target; the reservation's externalId is the STABLE booking id (so new/modified/cancelled
 * revisions of one booking all normalize to the same reservation).
 */
export function toRawRevision(r: ChannexBooking): RawRevision {
  const a: ChannexBookingAttributes = r.attributes ?? r;
  const bookingId = a.booking_id ?? r.id;
  return { revisionId: r.id, reservation: toRawReservation({ id: bookingId, attributes: a }) };
}
