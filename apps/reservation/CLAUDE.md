# App: Reservation System — product name **RevioCRS** (`@revio/reservation`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **IN BUILD — Phases 1+2+3 shipped
> 2026-07-03** (inventory foundation · Reservations/Holds · Rates & Restrictions: 4-level priority
> incl. property-default fallback, booking-source-scoped rules, /rates CRUD, editable Rate +
> resolved-Restrictions calendar rows, `stayViolation()` gate on search + holds). Phase 4 (dashboard/metrics: formula sheet in core, Reports+CSV,
> Action Center, Forecast, Global Search) shipped too. Next: **Phase 5 — distribution + settings.** Cookie `revio_crs_session`; port 3002; gated on the `hasReservation`
> entitlement. Gotcha: the RLS proxy (`lib/db.ts`) forwards `prisma.<model>.<op>` ONLY — no
> `$transaction`.

**Full V1 spec: `docs/CRS-REFERENCE.md` (founder spec v2, 2026-07-02)** — exact metric formulas,
reservation lifecycle, system rules, sitemap, and the 5-phase MVP build order. Read it before writing
any code here. The CRS is the **system of record for every reservation** (from any source) and computes
real performance metrics (Occupancy, ADR, RevPAR, Pickup…) from that record.

## V1 scope
Reservations (create/modify/cancel + the Hold lifecycle) · Inventory & Availability (the waterfall,
with date-sensitive out-of-order/closure periods) · Rates & Restrictions (+ property-default fallback,
+ booking-source scope) · Distribution via **one Connected Channel Manager** · Reports & Dashboard
(one shared formula sheet) · Guests (contact + booking history only — **not a CRM**) · Booking Sources ·
Taxes & Fees · Global Search · Permission Groups.

## NOT V1 (explicitly future)
Booking Engine (consumer site) · Payments · Folio/POS · full PMS ops · housekeeping · check-in/out ·
CRM/loyalty · revenue-management automation · AI forecasting · occupancy/LOS/package pricing ·
same-time-last-year pace · scheduled report emails.

## Architecture rules that bind the CRS to the platform
1. **One "Connected Channel Manager"**, identical whether it's RevioLink or third-party: a
   `ChannelManagerConnector` adapter in `@revio/core` — `RevioLinkInternalConnector` (shared core/DB,
   no network) + third-party impls later. The CRS never talks to an OTA directly.
2. **One availability waterfall in `@revio/core`**: `(physical − OOO − closed) − holds − confirmed`.
   Never reimplement it per screen. The CM's date-level inventory is the same model with OOO/Closed
   collapsed; the CRS makes them explicit dated records and adds Holds — additively.
3. **One metrics module**: Dashboard and Reports read the SAME formula implementations (pure functions
   in `@revio/core`, tested). No-shows count as Sold (togglable, default yes); Gross/Net toggle.
4. **Holds lock inventory the instant a room is selected** — before the form saves. Modifications are
   release→validate→re-hold→confirm→push; never drop the old inventory until the new is confirmed.
5. **Property time zone** governs all date logic. **Four currency fields** stored per reservation at
   booking time (already in the shared schema).
6. Same shell/auth/tenancy: third Next app, gated by `hasReservation` (Operator toggle exists), same
   session choke point, new tables carry `tenantId` + `tenant_isolation` RLS policy, own Railway service.

## Build order (spec's MVP phases)
1. Property & inventory foundation (+ pickup-snapshot job from day one)
2. Reservations (Hold mechanism, lifecycle, hold-expiry job)
3. Rates & restrictions
4. Dashboard & metrics (formula sheet, Action Center, Forecast)
5. Distribution (Connected CM, mapping, Sync/Error Center)

Background jobs (holds expiry, pickup snapshot, FX refresh, sync retry) need a scheduler — in-process
interval for the demo, BullMQ/cron when externalized (same infra as the CM's scheduled auto-pull).
