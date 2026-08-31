/**
 * Pure translation between our domain ARI/booking shapes (@revio/core) and the Channex API wire
 * format. Kept HTTP-free so it can be unit-tested without the network — the adapter just does I/O
 * around these functions. Channex API reference: https://docs.channex.io/api-v.1-documentation/ari
 */

import type { AriUpdate, RawReservation, RawRevision } from "@revio/core";
import { applyRates } from "./channex-occupancy.js";

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
  /*
   * TWO RATE SHAPES, and picking the wrong one is the OBP crux (§6.7a).
   *
   *   per_room   → `rate`, a single scalar.
   *   per_person → `rates`, an array of { occupancy, rate }.
   *
   * A per-person daily push is therefore NOT N calls, one per occupancy — it is ONE change object
   * carrying every occupancy for that date or range. Sending N objects would still be accepted, and
   * would multiply a year's push by the room's max occupancy for no benefit.
   *
   * They are mutually exclusive. Setting both leaves Channex to choose, which is a coin toss over
   * what a hotel charges.
   */
  rate?: number; // minor units, matching Channex's integer rate (e.g. 12000 = 120.00). Verified live.
  rates?: { occupancy: number; rate: number }[];
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
  /*
   * The party, as the OTA reported it (OBP §P2 / H8).
   *
   * Adults is the axis rates are priced on; children and infants are separate and must never be
   * folded into it. Channex sends these as strings on some channels and numbers on others, so both
   * are accepted and coerced once, here.
   */
  occupancy?: { adults?: number | string; children?: number | string; infants?: number | string } | null;
  /** Some channels put the count flat on the room instead of in an occupancy object. */
  adults?: number | string;
  children?: number | string;
  infants?: number | string;
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
  /*
   * The rate, in whichever of the two shapes this plan uses (§6.7a).
   *
   * `occupancyRates` means per-person: one change object carrying every occupancy. Its absence means
   * per-room and a scalar. `applyRates` owns that choice and deletes whichever field it is not
   * using, because leaving both set lets Channex pick.
   *
   * `channelSupportsOccupancy` is true here: degradation for a single-rate channel is decided by the
   * caller, which knows the channel — this mapper only knows the plan.
   */
  if (u.occupancyRates?.length) {
    const applied = applyRates({
      value,
      sellMode: "per_person",
      rates: u.occupancyRates,
      primaryOccupancy: u.primaryOccupancy ?? u.occupancyRates[u.occupancyRates.length - 1]!.occupancy,
      channelSupportsOccupancy: true,
    });
    if (applied.ok) Object.assign(value, applied.value);
  } else if (u.priceMinor != null) {
    value.rate = u.priceMinor;
  }
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
      // The party size, so the downstream folio can reconcile (§P2). Absent when the channel said
      // nothing — never defaulted, because a guessed occupancy looks like fact and prices the stay
      // wrongly with nothing to notice.
      const adults = inboundAdults(room);
      return {
        externalRoomId: room.room_type_id,
        externalRateId: room.rate_plan_id,
        quantity: 1,
        checkIn,
        checkOut,
        ...(priceMinor != null ? { priceMinor } : {}),
        ...(adults != null ? { adults } : {}),
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

/**
 * The party size on an inbound channel booking — OBP §P2.
 *
 * ## Why this is not just `Number(room.adults)`
 *
 * The count must land on the reservation or the downstream folio cannot reconcile: a per-person
 * property that books two guests and bills for the default occupancy is the parity failure arriving
 * from the inbound side, and it is silent because every number involved looks plausible.
 *
 * Channels disagree about where it lives and what type it is — an `occupancy` object on some, flat
 * fields on others, strings on several. All of that is coerced once, here, rather than at each
 * caller.
 *
 * Returns `null` rather than a default when the channel said nothing. A guessed occupancy is worse
 * than an absent one: absent can be resolved by the plan's primary and flagged, whereas a guess
 * looks like fact and prices the stay wrongly with nothing to notice.
 */
export function inboundAdults(room: {
  occupancy?: { adults?: number | string } | null;
  adults?: number | string;
}): number | null {
  const raw = room.occupancy?.adults ?? room.adults;
  if (raw == null) return null;
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  // Zero adults is not a party; some channels send 0 when they mean "not stated".
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.trunc(n), 18) : null;
}
