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
- `adapters/` — the `ChannelAdapter` interface every OTA implements, plus `MockChannelAdapter` so the
  whole loop runs on demo data before any real certification.

## Rules
- **Pure and tested.** No DB, no HTTP, no framework imports here. Functions in / values out, so the
  same logic is reused by apps, jobs, and tests, and can be extracted to a service later untouched.
- **Money is integer minor units** + ISO currency. Never floats for money.
- Inventory dates are calendar dates (`YYYY-MM-DD`); the property's timezone resolves "today".
- Changing a function's behavior here changes every product — add tests alongside.
