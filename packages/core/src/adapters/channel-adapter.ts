/**
 * The single interface every OTA is reached through. Booking.com, Expedia, Channex, and the demo
 * MockChannelAdapter all implement this. Swapping a real OTA in for the mock changes nothing else.
 *
 * See root CLAUDE.md ("Connectivity is behind an adapter").
 */

import type { IsoDate } from "../domain/types.js";

/** One date's ARI for one product, as pushed to a channel. */
export interface AriUpdate {
  externalRoomId: string;
  externalRateId: string;
  date: IsoDate;
  /**
   * Channel-facing bookable count (after stop-sell / allotment).
   *
   * **Optional means "not being changed".** A push must carry only the fields the user actually
   * edited: sending a rate change with `bookable` attached re-asserts an availability the caller
   * never touched, and channels treat that as an instruction. Channex rejects it outright during
   * certification ("update should contain only rates"), and in production it would overwrite values
   * set elsewhere — including by the hotel in the channel's own extranet.
   *
   * A full re-sync legitimately sets every field; a targeted edit sets one.
   */
  bookable?: number;
  priceMinor?: number;
  /**
   * Per-occupancy prices, for a plan that sells per person (OBP §6.7a).
   *
   * When present this REPLACES `priceMinor` rather than accompanying it — a per-person plan sends a
   * `rates[]` array and a per-room plan sends a scalar, and the two are mutually exclusive on the
   * wire. Carrying both would leave Channex to choose which of two numbers a hotel charges.
   *
   * Ordered by occupancy and sent in ONE change object, not one object per occupancy.
   */
  occupancyRates?: { occupancy: number; minor: number | null }[];
  /** Which occupancy a single-rate channel is given when it cannot take the array. */
  primaryOccupancy?: number;
  currency: string;
  restrictions: {
    stopSell?: boolean;
    minLos?: number;
    maxLos?: number;
    cta?: boolean;
    ctd?: boolean;
    advancePurchaseMin?: number;
    advancePurchaseMax?: number;
  };
}

export interface PushResult {
  ok: boolean;
  /** Per-update failures, so a single unsupported restriction surfaces in the Error Center. */
  rejected: Array<{ update: AriUpdate; reason: string }>;
  channelResponseId?: string;
  /** Async task/queue ids the channel returned (e.g. Channex task ids) — recorded for auditing
   *  and PMS certification, where each push's task id is submitted as proof. */
  taskIds?: string[];
  /**
   * The same ids, each labelled with the endpoint that produced it.
   *
   * `taskIds` is order-dependent, and relying on that order is how the wrong id ends up in the wrong
   * certification form field — a rates payload submitted as the availability one reads to a reviewer
   * as "expected one Availability update, found 0". The label travels with the id so it cannot be
   * mixed up downstream.
   */
  tasks?: Array<{ kind: "rates" | "availability"; id: string }>;
}

/** A booking as it comes back from a channel, before it becomes a domain Reservation. */
export interface RawReservation {
  externalId: string;
  guestName: string;
  status: "confirmed" | "modified" | "cancelled";
  lines: Array<{
    externalRoomId: string;
    externalRateId: string;
    quantity: number;
    checkIn: IsoDate;
    checkOut: IsoDate;
    /**
     * What this room costs for the whole stay, in minor units. Optional because not every channel
     * breaks the total down per room — but when it is known it MUST be carried, because the PMS
     * seeds the guest's folio from it. Without it the room line on the bill is zero.
     */
    priceMinor?: number;
  }>;
  totalMinor: number;
  currency: string;
}

/** One item from a channel's booking-revisions feed: a booking event (new/modified/cancelled) plus
 *  the id to acknowledge so it isn't re-delivered. */
export interface RawRevision {
  revisionId: string;
  reservation: RawReservation;
}

/** A product as the CHANNEL knows it — its own id/code + display name (spec §3.6: mapping
 * offers the OTA's real products in a dropdown instead of hand-typed ids). */
export interface ExternalProduct {
  id: string;
  name: string;
}

export interface ChannelAdapter {
  /** e.g. "booking", "expedia", "mock". */
  readonly channelCode: string;
  /** Push availability/rate/restriction updates out. */
  pushAri(updates: AriUpdate[]): Promise<PushResult>;
  /** Pull bookings created/changed since a cursor. */
  pullReservations(since: string): Promise<RawReservation[]>;
  /**
   * Certified booking-revisions feed pull (Channex): returns only UN-acknowledged revisions. When an
   * adapter implements this, callers should prefer it over pullReservations and acknowledge each
   * revision after processing. Optional — adapters without a real feed (e.g. the mock) omit it.
   */
  pullRevisions?(): Promise<RawRevision[]>;
  /** Acknowledge a booking revision (pairs with pullRevisions). */
  acknowledgeBooking?(revisionId: string): Promise<{ ok: boolean; error?: string }>;

  /**
   * List the channel's own room types + rate plans (with the OTA-side product codes), so the
   * Mapping screen can offer dropdown mapping. Optional — absent means manual-id entry only.
   */
  listProducts?(): Promise<{ rooms: ExternalProduct[]; rates: ExternalProduct[] }>;
}
