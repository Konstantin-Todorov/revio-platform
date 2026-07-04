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
  /** Channel-facing bookable count (after stop-sell / allotment). */
  bookable: number;
  priceMinor: number;
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
}
