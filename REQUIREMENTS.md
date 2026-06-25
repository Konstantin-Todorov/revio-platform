# RevioLink (Channel Manager) — Requirements & Gap Analysis

Traceability between the spec (`docs/` — CM Developer Reference + questionnaire answers) and the build.
Updated as work lands. **Status:** ✅ built · 🟡 partial · 🟦 planned (in `BUILD-PLAN.md`) · ⛔ gap to close now.

## Cross-cutting

| Requirement | Status | Where / note |
| --- | --- | --- |
| Multi-tenant, one shared inventory core | ✅ | `@revio/core`, `tenantId` on every row |
| Row-Level Security (DB-enforced isolation) | 🟡 | Columns in place; RLS policy migration pending |
| Products sold separately via entitlements | ✅ | `Tenant.hasChannelManager/Reservation/Pms` |
| EN + BG localisation | 🟦 | Strings will route through an i18n layer; copy is EN now |
| **Hotels & apartments same logic; hostels sell beds** | ⛔→✅ | **`RoomType.unitKind` (room \| bed \| apartment)** — this change |
| Desktop + limited mobile | 🟦 | Responsive shell; mobile polish later |

## Data model (Rooms & Rates)

| Requirement | Status | Where / note |
| --- | --- | --- |
| Room Type (name, code, total inventory, max guests, active) | ✅ | `RoomType` |
| Rate Plan (name, code, linked room types, policy, meal, active) | ✅ | `RatePlan` |
| Product = Room Type × Rate Plan | ✅ | `RatePlanRoomType` |
| **Rate Plan arbitrary names + tags** (meal/cancellation orientation) | ⛔→✅ | **`RatePlan.tags String[]`** — this change |
| Derived rates (±%/±fixed, rounding, floor, ceiling, parent) | ✅ | `RatePlan.derived*` + `@revio/core` `deriveRate` |
| Channel-specific price adjustment | ✅ | `@revio/core` `applyChannelAdjustment` |
| **Occupancy-based pricing** ("2 guests − €10 = 1 guest") | ⛔→✅ | **`OccupancyAdjustment` model + core helper** — this change |
| Cancellation policies / Meal plans (supporting data) | ✅ | `CancellationPolicy`, `MealPlan` |

## Calendar / Restrictions

| Requirement | Status | Where / note |
| --- | --- | --- |
| Availability = inventory − confirmed (manual override = baseline) | ✅ | `@revio/core` `computeAvailability` |
| Stop Sell as separate flag (0 bookable, count untouched) | ✅ | `@revio/core` `bookableForChannel` |
| Min/Max LOS, CTA, CTD, Advance Purchase, Channel Allocation | ✅ | `DailyCell`, `RestrictionRule`, `RestrictionType` |
| Restriction priority: manual > rule > rate-plan default | ✅ | `@revio/core` `resolveRestriction` |
| Calendar grid screen (ARI per cell, inline edit, cell actions) | 🟦 | Phase 2 (this build) |
| Bulk Update screen | 🟦 | Phase 4 |

## Channels / Mapping / Reservations

| Requirement | Status | Where / note |
| --- | --- | --- |
| Channels (status, currency, commission, supported restrictions) | ✅ | `Channel` |
| Mapping (room/rate/product, statuses) | ✅ | `ProductMapping` |
| Per-channel currency conversion + markup | ✅ | `Channel.conversionType/markupPct/rounding` |
| Reservations import (read-only, multi-line, statuses, overbooked) | ✅ | `Reservation`, `ReservationLine`; `isOverbooking` in core |
| ChannelAdapter interface + Mock for demo | ✅ | `@revio/core/adapters` |
| Real OTA / Channex adapters | 🟦 | Post-demo, same interface |

## Monitoring / Settings

| Requirement | Status | Where / note |
| --- | --- | --- |
| Dashboard (distribution health, not performance) | 🟦 | Phase 2 (this build) |
| Sync Center / Error Center / Audit Log | ✅ data · 🟦 screens | `SyncEvent`, `ErrorItem`, `AuditEntry` |
| Settings (property, currency, users, API/PMS placeholder) | 🟦 | Phase 4 |

## Schema changes to close before building screens (this turn)

1. **`RoomType.unitKind`** — `room` \| `bed` \| `apartment`. Encodes the hotel/apartment-vs-hostel
   distinction: hostels sell beds, so availability is controlled at bed level. Hotels stay `room`.
2. **`OccupancyAdjustment`** — per rate plan, a price delta by guest count (occupancy). Implements the
   questionnaire's "price for 2 guests − €10 = price for 1 guest". Math added to `@revio/core`.
3. **`RatePlan.tags String[]`** — arbitrary tags so a hotel can label what a plan contains
   (e.g. `breakfast`, `non-refundable`, `corporate`), as required by "give them any names and tags".
