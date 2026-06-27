# App: Reservation System / CRS (`@revio/reservation`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **Phase 2 — not the current build.**

**Full V1 spec: `docs/CRS-REFERENCE.md`** (founder doc, 2026-06-27). The CRS is the **system of record
for every reservation** (from any source) and computes real performance metrics (Occupancy, ADR, RevPAR,
Pickup…) from that record. Reads/writes inventory only through `@revio/core`.

## V1 scope (build) — see `docs/CRS-REFERENCE.md` for detail
Reservations (create/modify/cancel + the Hold lifecycle) · Inventory & Availability (the waterfall) ·
Rates & Restrictions · Distribution via **one Connected Channel Manager** · Reports & Dashboard ·
Guests (contact + booking history only — **not a CRM**).

## NOT V1 (explicitly future)
Booking Engine (consumer site) · Payments · Folio/POS · full PMS ops · housekeeping · check-in/out · CRM/
loyalty · revenue-management automation · AI forecasting. *(The earlier draft of this file listed Booking
Engine/Payments/Folio as scope — that is wrong per the new spec; they are future.)*

## Two architecture rules that bind the CRS to the rest of the platform
1. **One "Connected Channel Manager", treated identically whether it's RevioLink or a third-party CM.**
   On our shared-core platform this is an **adapter boundary parallel to the CM's `ChannelAdapter`**: a
   `ChannelManagerConnector` with a **RevioLink-internal** impl (shared core/DB, no network) and a
   **third-party** impl (real push/pull). The CRS never talks to an OTA directly.
2. **One availability waterfall in `@revio/core`** (Physical − OOO − Closed − Holds − Confirmed),
   used by both apps — never a second copy. Phase 1a already seeded it (`computeAvailability`).

## Not now
Do not build during the CM phase. Sequenced after CM V2 (`BUILD-PLAN.md`); same Postgres/core/shell,
entitlement-gated. The shared Reservation/Guest model grows additively when this lands.
