# App: Channel Manager (`@revio/channel-manager`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. This file narrows scope to CM.

**This is the first product, the sales demo, and the priority.** It is a pure distribution tool:
inventory out, bookings in, nothing else. It reads/writes inventory **only** through `@revio/core`.

## What CM does (and only this)
The ARI loop: keep the one true Availability/Rate/Restriction numbers, push them to mapped channels,
pull bookings back, decrement availability, re-push so nobody oversells.

## What CM deliberately does NOT do
No occupancy/ADR/RevPAR, no payments, no housekeeping, no guest profiles, no direct-booking engine.
Those belong to Reservation/CRS and PMS. Do not add them here.

## Screens (V1 — match `docs/` CM Developer Reference and the reference screenshot)
- **Dashboard** — distribution *health*, not performance: connected channels, active products,
  unmapped products, failed syncs, pending updates, last sync, stop-sold, currency warnings,
  latest reservation imports, recent changes, quick actions.
- **Calendar** — the grid (room types/rate plans × dates), live ARI per cell, inline + drag edits.
- **Bulk Update** — large changes across dates/rooms/rates/channels at once.
- **Rooms & Rates** — Room Types, Rate Plans, Derived Rates, Cancellation Policies, Meal Plans.
- **Restrictions** — Restriction Rules + quick Stop Sell + quick Advance Purchase.
- **Channels** — Connected Channels, Add Channel, **Mapping**, Channel Settings (currency/commission).
- **Reservations** — read-only imports from channels.
- **Sync Center** — live push/pull feed; retry/refresh/pause.
- **Error Center** — prioritized actionable problems (incl. config issues, not just sync failures).
- **Audit Log** — permanent record of every change.
- **Settings** — Property, Currency, Users & Permissions, API/PMS connection (placeholder).

## Key behaviors to get right
- Availability = total inventory − confirmed reservations (computed), unless a manual cell override
  sets a new baseline. **Stop Sell is a separate flag** — it sends "0 bookable" without changing the count.
- **Derived rates** recalc automatically from their parent unless a specific date was manually overridden.
- **Restriction priority:** manual edit / Bulk Update > Restriction Rule > Rate Plan default.
- All of the above already live as pure functions in `@revio/core` — call them, don't reimplement.

## Demo
Runs entirely on seeded data via `MockChannelAdapter`. Seed mirrors the reference screenshot
(Hotel Sofia: Deluxe Double, Superior Twin, …; Booking.com/Expedia/Trip.com/Agoda).
