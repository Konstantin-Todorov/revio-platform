/**
 * Shared domain types for the whole Revio platform.
 * One definition imported by every app. See packages/core/CLAUDE.md.
 */

// --- Primitives ------------------------------------------------------------

/** Calendar date in `YYYY-MM-DD`. Inventory is tracked per calendar date. */
export type IsoDate = string;

/** Money as integer minor units (e.g. cents) + ISO 4217 code. Never use floats for money. */
export interface Money {
  /** Amount in minor units, e.g. 12000 = 120.00. */
  readonly minor: number;
  /** ISO 4217, e.g. "EUR". */
  readonly currency: string;
}

export type TenantId = string & { readonly __brand: "TenantId" };
export type PropertyId = string & { readonly __brand: "PropertyId" };
export type RoomTypeId = string & { readonly __brand: "RoomTypeId" };
export type RatePlanId = string & { readonly __brand: "RatePlanId" };
export type ChannelId = string & { readonly __brand: "ChannelId" };
export type ReservationId = string & { readonly __brand: "ReservationId" };

// --- Tenancy & properties --------------------------------------------------

/** Which products a hotel has bought. "Sold separately" is enforced here, not in code separation. */
export interface Entitlements {
  channelManager: boolean;
  reservation: boolean;
  pms: boolean;
}

export interface Property {
  id: PropertyId;
  tenantId: TenantId;
  name: string;
  timezone: string;
  baseCurrency: string;
  /** How many days into the future the calendar generates & pushes (e.g. 365). */
  syncHorizonDays: number;
}

// --- The thing being sold --------------------------------------------------

/**
 * What a sellable unit is. Hotels/apartments sell whole units; hostels sell beds, so a "bed" unit
 * counts beds in `totalRooms` and controls availability per bed.
 */
export type UnitKind = "room" | "bed" | "apartment";

/** The physical product — e.g. "Deluxe Double", 12 of them exist. */
export interface RoomType {
  id: RoomTypeId;
  propertyId: PropertyId;
  name: string;
  /** Short internal reference, e.g. "DDR". */
  code: string;
  unitKind: UnitKind;
  /** How many physical rooms (or beds, for hostels) of this type exist — a cap / safety-net.
   *  Actual rooms-to-sell is managed per date (see availability); this is not the sell allotment. */
  totalRooms: number;
  maxGuests: number;
  active: boolean;
}

export type PriceLogic = "manual" | "derived";

/** A pricing/policy wrapper sold against one or more Room Types. */
export interface RatePlan {
  id: RatePlanId;
  propertyId: PropertyId;
  name: string;
  code: string;
  /** Arbitrary labels for orientation, e.g. ["breakfast","non-refundable"]. */
  tags: string[];
  linkedRoomTypeIds: RoomTypeId[];
  priceLogic: PriceLogic;
  /** Present when priceLogic === "derived". */
  derivedFrom?: DerivedRateConfig;
  /** Fallback restrictions applied unless something more specific overrides them. */
  defaults: RestrictionDefaults;
  active: boolean;
}

/** Room Type + Rate Plan — the actual thing a guest books and what is mapped to a channel. */
export interface Product {
  roomTypeId: RoomTypeId;
  ratePlanId: RatePlanId;
}

// --- Channels & mapping ----------------------------------------------------

export type ChannelStatus =
  | "connected"
  | "not_connected"
  | "pending"
  | "error"
  | "disabled";

export interface Channel {
  id: ChannelId;
  propertyId: PropertyId;
  /** e.g. "booking", "expedia", "trip", "agoda". */
  code: string;
  name: string;
  status: ChannelStatus;
  /** The OTA's own identifier for this property. */
  externalPropertyId?: string;
  /** Restriction types this channel actually supports (others aren't worth sending). */
  supportedRestrictions: RestrictionType[];
}

export type MappingStatus =
  | "complete"
  | "incomplete"
  | "missing_room"
  | "missing_rate"
  | "channel_error"
  | "disabled"
  | "pending_confirmation";

/** Links our internal product to the channel's own IDs. Updates only land when mapping is complete. */
export interface ProductMapping {
  channelId: ChannelId;
  roomTypeId: RoomTypeId;
  ratePlanId: RatePlanId;
  externalRoomId?: string;
  externalRateId?: string;
  status: MappingStatus;
}

// --- Restrictions ----------------------------------------------------------

export type RestrictionType =
  | "stop_sell"
  | "min_los"
  | "max_los"
  | "cta" // closed to arrival
  | "ctd" // closed to departure
  | "advance_purchase_min"
  | "advance_purchase_max"
  | "channel_allocation";

/** Fallback restriction baseline carried on a rate plan. */
export interface RestrictionDefaults {
  stopSell: boolean;
  minLos?: number;
  maxLos?: number;
  cta?: boolean;
  ctd?: boolean;
  advancePurchaseMin?: number;
  advancePurchaseMax?: number;
}

// --- Reservations ----------------------------------------------------------

export type ReservationStatus =
  | "confirmed"
  | "modified"
  | "cancelled"
  | "failed_import"
  | "overbooked";

export interface ReservationLine {
  roomTypeId: RoomTypeId;
  ratePlanId: RatePlanId;
  /** Number of rooms of this type on this line (a booking can cover more than one). */
  quantity: number;
  checkIn: IsoDate;
  checkOut: IsoDate;
}

export interface Reservation {
  id: ReservationId;
  propertyId: PropertyId;
  channelId: ChannelId;
  externalId: string;
  guestName: string;
  status: ReservationStatus;
  lines: ReservationLine[];
  total: Money;
  importedAt: string; // ISO datetime
}

// Forward reference used by RatePlan.
import type { DerivedRateConfig } from "../rates/derive.js";
export type { DerivedRateConfig };
