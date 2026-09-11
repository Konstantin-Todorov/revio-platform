# Package: Core (`@revio/core`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **This is the source of truth.**

Every app reads and writes inventory **through this package only**. If you are tempted to write an
inventory/rate/restriction query inside an app, stop — add it here instead, behind a function.

## What lives here
- `domain/` — the entity types shared by every app (Property, RoomType, RatePlan, Product,
  Reservation, Channel, Mapping, Money, …). One definition, imported everywhere.
- `inventory/` — **availability** computation. Availability = total inventory − confirmed reservations,
  unless a manual override sets a new baseline. **Stop Sell is a separate flag** (sends 0 bookable
  without changing the count). This is the most important data-model decision in the platform.
- `rates/` — the **derived-rate engine**. A rate plan's price computed from a parent (±%, ±fixed,
  direction, rounding, floor, ceiling) + channel-specific adjustment on send. Recalculates when the
  parent changes, unless a date was manually overridden.
- `restrictions/` — **priority resolution**: manual edit / Bulk Update > Restriction Rule >
  Rate Plan default.
- `guests/` — identity and rights. `merge.ts` (duplicate detection + merge, shared by CRS and PMS),
  `contact-hydration.ts` (enrich-empty / never-overwrite / tag-OTA), `erasure.ts` (GDPR Art. 15/17/20).
  **Erasure anonymises in place and never deletes** — reservations carry `guestId` and occupancy is
  computed from stays, so removing a guest would rewrite the hotel's history; tax invoices are
  retained under Art. 17(3)(b). It must also clear `Reservation.guestName`, the denormalised copy.
- `metrics/` — the CRS **formula sheet** (occupancy, ADR, RevPAR, cancellation rates, LOS, lead time,
  pickup; room-nights with range clipping + prorated revenue). Dashboard and Reports read the SAME
  functions — the numbers cannot disagree.
- `adapters/` — the `ChannelAdapter` interface every OTA implements, plus `MockChannelAdapter` so the
  whole loop runs on demo data before any real certification; and `ChannelManagerConnector` — the
  CRS's one way out to distribution (`RevioLinkInternalConnector` = shared-DB no-op; third-party CMs
  implement the same interface).

- `billing/` — **what we charge hotels.** Platform fee by room tier, module fee per product, bundle
  discount by module count, and the 2% RevioDirect usage fee. It moved here from the operator app on
  2026-09-11, when the hotel products needed to show a customer their own bill: the invoice and the
  screen must be produced by one function or they will disagree, and the customer will be right.
  ⚠️ `billableEntitlements` is the one to know — a product on a running trial is **not** billed, and
  because the discount is priced by the number of modules, forgetting it gets the *paid* products
  wrong too. `BilledProductKey` here is `"channelManager" | "reservation" | "pms"` (the entitlement
  columns), NOT the `ProductKey` in `products/` which is `"cm" | "crs" | "pms"`.
- `trials/` — trial state, the reminder schedule, who may start one (`canSelfStartTrial`), and what
  the banner inside a hotel's own product says (`trialBanner`). The tone thresholds are the same days
  the reminder emails use, deliberately: a strip and an inbox that disagree about urgency are worse
  than either alone.

## Rules
- **Pure and tested.** No DB, no HTTP, no framework imports here. Functions in / values out, so the
  same logic is reused by apps, jobs, and tests, and can be extracted to a service later untouched.
- **Money is integer minor units** + ISO currency. Never floats for money.
- Inventory dates are calendar dates (`YYYY-MM-DD`); the property's timezone resolves "today".
- Changing a function's behavior here changes every product — add tests alongside.
