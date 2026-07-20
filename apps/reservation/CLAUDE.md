# App: Reservation System — product name **RevioCRS** (`@revio/reservation`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **IN BUILD — Phases 1+2+3 shipped
> 2026-07-03** (inventory foundation · Reservations/Holds · Rates & Restrictions: 4-level priority
> incl. property-default fallback, booking-source-scoped rules, /rates CRUD, editable Rate +
> resolved-Restrictions calendar rows, `stayViolation()` gate on search + holds). Phases 4+5 (dashboard/metrics + distribution/settings)
> shipped too — **V1 COMPLETE (all 5 phases live 2026-07-03)**. Next: Channex cert prep, then RevioPMS. Cookie `revio_crs_session`; port 3002; gated on the `hasReservation`
> entitlement. Gotcha: the RLS proxy (`lib/db.ts`) forwards `prisma.<model>.<op>` ONLY — no
> `$transaction`.

> **V2 overhaul in flight (founder spec 2026-07-09: `docs/specs/CRS-GUIDE-V1.md` — read it before
> changing any CRS screen; Keep sections are binding).** Headlines: **the 4-level priority is replaced
> by the two-tier precedence model** (date-scoped edits carry lastModified+source, calendar/bulk are
> peers by recency → rate-plan default → property default); nav regroups into Overview / Bookings /
> Inventory & Rates / Configuration and **Rates & Restrictions dissolves three ways** (products →
> Rooms & Rates [new, absorbs Inventory Setup]; standing defaults → Settings; restriction rules →
> Bulk Rates & Availability [new]); Reports → Analytics (6 CRS-native sub-tabs); YoY on every KPI
> (STLY = 364 days); group/portfolio scope; Distribution gets CM-switching + CRS↔CM mapping;
> **standalone-vs-integrated** is load-bearing (see `docs/specs/HIERARCHY.md` §6). The booking engine
> is deferred but its three seams are mandatory now (`docs/specs/BOOKING-ENGINE-ADDENDUM.md`).
> Task phases A (foundations) + C (CRS screens) in the tracker.

> **🔜 Refinement Round 2 intake (founder docs 2026-07-20: `docs/specs/CRS-REFINEMENT-R2.md` — read it
> before changing any CRS screen; NOT yet built, plan pending sign-off).** Refines the shipped V2. Its
> sibling file (title typo'd "RevioCRS") is actually the **RevioLink/CM** doc (`CM-REFINEMENT-R1.md`); this
> CRS doc says to *match RevioLink / reuse RevioLink components*. Asks:
> Dashboard **YoY/LW toggle** with per-delta basis labels (YoY=364d, LW=7d, persist per user; the
> Reservation-Summary card is a CM-only ask, not requested for CRS);
> **Analytics full redesign** (period summary cards + evolution bar charts + performance-by-room-type,
> raw day table kept as drill-down); Reservations 3-click column sort (asc→desc→chronological, single
> active sort, display-only); Guests **Notes** tab (multi-note, author+timestamp, on the shared guest
> record); Inventory Calendar → **match RevioLink** (bulk edit in a modal **over** the calendar, remove
> the derived-rates display filter, **paperclip** marks derived rows, hide the top search bar); Rooms &
> Rates → **editable Rate Plan Linkage** (no-cycles / recalc-on-change / manual-parent-only / respect
> precedence / existing-data decision); Bulk Rates & Availability → **multi-field editor** (≥1 field) +
> **confirm-then-result modal** (green/red, X/backdrop) + rename "Restriction Rules" → "Your active
> restriction rules"; Settings → low-availability alert threshold + **staff user-management CRUD on the
> one shared identity**. **One bulk engine + one modal pattern + one comparison model + one shared
> identity + paperclip=derived everywhere** are cross-cutting invariants. CM is the finished reference —
> reuse RevioLink components. Task phase **G** to be created on sign-off.

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
