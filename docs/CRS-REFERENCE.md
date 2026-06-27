# RevioCRS — Developer Reference (founder spec, 2026-06-27)

Faithful, engineering-organised capture of the "Central Reservation System — Developer Reference" doc,
plus **how it fits our shared-core platform** and **what it means for the CM today** (see the last two
sections). This is the source of truth for `apps/reservation` (RevioCRS). Not started yet — sequenced
after the CM V2 work (`BUILD-PLAN.md`).

## What the CRS is (vs the CM)
- **CM (RevioLink)** answers *"is my ARI syncing to channels?"* — pure plumbing, no revenue concept.
- **CRS (RevioCRS)** answers *"how is the property actually selling — bookings, revenue, availability?"*
  It is the **system of record for every reservation** (from any source) and computes real performance
  metrics (Occupancy, ADR, RevPAR, Pickup…) from that record.

## Core architecture decision — one "Connected Channel Manager", always
The CRS **never talks to an OTA directly**. Every property connects to **exactly one Channel Manager**,
and that link always works the same way: **push ARI out, pull reservations back**. There is no
"direct-to-OTA" mode and no "internal vs external" branch — just *which* CM is connected:
- **Default = RevioLink** (our CM) for partners with no existing CM.
- **Otherwise** = whatever third-party CM they already run (SiteMinder, RoomRaccoon, …).
Build **one** integration pattern (a "Connected Channel Manager" relationship); RevioLink is just its
default value, handled identically to a third-party CM.

## V1 scope
**Build:** Reservations (create/modify/cancel + lifecycle) · Inventory & Availability · Rates &
Restrictions · Distribution (via the connected CM) · Reports & Dashboard · Guests (contact + booking
history only — **not a CRM**).
**Future (not V1):** full PMS ops · housekeeping · check-in/out · folios/POS · payments · CRM/loyalty ·
booking engine · revenue-management automation · AI forecasting.

## Entities (data model)
```
Property
├── Room Types → date-sensitive Inventory (out-of-order periods, closures)
├── Rate Plans → Policies (cancellation, meal) + Restrictions
├── Reservations → Guests (contact details) + Holds (temp inventory locks)
├── Booking Sources (a reporting category each Channel belongs to)
├── Distribution → Connected Channel Manager (RevioLink or third-party)
└── Reports (calculated from Reservations + Inventory — never stored)
```

## Availability waterfall — THE single source of truth (never reimplement)
```
Total Physical Rooms − Out-of-order − Closed            = Available Rooms
Available Rooms      − Reservation Holds − Confirmed     = Remaining Availability
```
- **Out-of-order** = physically unusable (broken/renovation). **Closed** = physically fine but
  deliberately withheld (owner/VIP/buffer). Separate flags/reasons (matters for reporting); same effect.
- **Reservation Hold** = a temporary lock placed the instant a room is selected (before confirm) — this
  is the overbooking-prevention mechanism. A background job releases expired holds.

## Reservation lifecycle
`Draft → Hold → Confirmed` (Modified is a *flag* on Confirmed, not a branch). Terminal/other:
Expired (hold timed out), Cancelled, No-show (only after check-in date passes), Failed (validation),
Checked-in/Checked-out/Archived (future, need PMS). **Modify is never an in-place edit** — it follows
release → validate new → re-hold → confirm → push; if the new dates have no availability, the original
stays untouched.

## Currency handling (store all four, at booking time)
Original booking currency · converted property-currency amount · **exchange rate used** · **conversion
timestamp**. Without the rate+timestamp, historical reports become unreproducible when FX moves.

## Restriction priority (defined once)
Manual edit on the Inventory Calendar > Restriction Rule (date/source/channel-scoped) > Rate Plan
default > **Property default** (global fallback). Same as the CM, plus the property-level fallback.

## Core metrics (one formula sheet, Dashboard + Reports both read it)
Room-Night = 1 room × 1 night (everything is built from this).
- **Available Room-Nights** = (Physical − OOO − Closed) × nights
- **Rooms Sold** = Σ(rooms × nights) for confirmed reservations overlapping the period
- **Occupancy %** = Rooms Sold ÷ Available Room-Nights
- **Room Revenue** = accommodation-only revenue (taxes/fees/extras excluded unless bundled)
- **ADR** = Room Revenue ÷ Rooms Sold · **RevPAR** = Room Revenue ÷ Available Room-Nights (= ADR × Occ)
- **Cancellation Rate** (headline) and **Cancelled Room-Night Rate** (weighted, for the report)
- **Pickup** = rooms sold for a future range now − the same as of a stored nightly snapshot · **Pace** =
  pickup over time · **Lead Time** · **Average LOS** · **Channel/Source Mix**
- Settings toggles (default in parens): **No-shows counted as sold** (yes) · **Gross vs Net** revenue
  (Gross; Net = Gross − commission).

## Background jobs
Retry failed syncs (5 min) · Release expired holds (few min) · Refresh FX (hourly) · **Generate pickup
snapshot (nightly — start this job in Phase 1 even though Pickup reporting is Phase 4; you can't backfill
snapshots you never took)** · Archive logs (daily). All time logic uses the **property's** time zone.

## Sitemap
Dashboard · Reservations (List/Create/Modify/Cancellations/Calendar/Availability Search) · Availability &
Rates (Inventory Calendar/Bulk Update/Rate Plans/Derived Rates/Restrictions) · Properties (Profile/Room
Types/Inventory Setup/Policies/Taxes & Fees) · Distribution (Connected CM/Channels/Mapping/Channel
Rules/Sync Logs) · Booking Sources · Guests (Details/History/Special Requests) · Reports (Performance/
Pickup & Pace/Source/Cancellation/Availability) · Sync Center · Error Center · Settings · **Global Search**
(reachable everywhere — by reservation id, guest, phone, email, dates, company, channel, room, status).

## Booking Sources
A reporting **label** each Channel carries (not a thing booked "through"): Direct, OTA, GDS, Call Center,
Corporate, Travel Agent. Call Center + Direct/manual never go through a CM.

## Mapping (one layer only)
Internal Room Type / Rate Plan ↔ the **connected CM's** equivalent. The CM owns its own mapping down to
each individual OTA; the CRS never needs that layer. (Mirrors our two-stream CM mapping idea.)

## Taxes & Fees
Per tax/fee: Type (% or fixed) · Basis (per room/person/night/stay) · Inclusion (included/excluded in
displayed rate → feeds the Room Revenue formula). Age exemptions = future.

## Permissions (configurable, not hardcoded)
Permission Groups: Reservations · Rates · Inventory · Restrictions · Users · Reports · Distribution ·
Finance. Each group has None/View/Edit per role. V1 roles: Owner, Admin (all but Finance), Revenue
Manager, Reservations Agent, Read-only.

## MVP build order (the doc's own)
1. Property & inventory foundation (+ stand up the nightly pickup-snapshot job now)
2. Reservations (Create/Modify/Cancel, the Hold mechanism + lifecycle, hold-expiry job, availability cut)
3. Rates & restrictions
4. Dashboard & metrics (Action Center, Forecast)
5. Distribution (Connected CM, Mapping, Sync Center, Error Center)

---

## How it fits OUR platform (shared core) — the key synergy decision
The CRS spec is written "standalone, connect to any CM." On our platform RevioCRS and RevioLink **share
one Postgres + one `@revio/core`**, gated by entitlements. Reconcile the two like this:

- **"Connected Channel Manager" is an adapter boundary — exactly parallel to the CM's `ChannelAdapter`.**
  - CM↔OTA today: `ChannelAdapter` (Mock | Channex | …) — already built in `@revio/connectivity`.
  - CRS↔CM tomorrow: a `ChannelManagerConnector` with two implementations — **RevioLink-internal**
    (shared core/DB, no network round-trip) and **third-party** (real push/pull). The CRS code can't
    tell them apart — same interface — which is exactly what the spec demands.
- **One availability waterfall in `@revio/core`, used by both apps.** Phase 1a already put the seed of
  this there (`computeAvailability = inventory − sold`). When the CRS lands, that function grows to the
  full waterfall (Physical − OOO − Closed − Holds − Confirmed). Both apps read it; no second copy.
- **One shared Reservation/Guest model.** When both products are on, there is ONE reservation table; the
  CM imports OTA bookings, the CRS adds direct/call-center bookings + the richer lifecycle. The model
  grows additively (sources, hold/no-show statuses, currency fields).

## What this means for the CM **now** (so the CRS snaps in cleanly)
- ✅ **Inventory model — already aligned.** Phase 1a's date-level "rooms to sell − derived sold" is a
  clean subset of the CRS waterfall. OOO/Closed/Holds are future *reductions* on top — additive, no rework.
- 🟡 **Currency (CM Phase 1b) — design for the CRS now.** When we move currency to the property + add FX
  conversion, **store all four currency fields on each reservation** (original / converted / rate /
  timestamp) so we never have to migrate reservation history later. This is the one concrete adjustment.
- 🟡 **Restriction priority — add a Property-default fallback** (below rate-plan default). Small; do with
  CM Phase 1c or at CRS time.
- 🔵 **Booking Source on Channel** (a reporting category) and **OOO/Closed room records** are CRS-owned
  and future-additive — no CM change now; `RoomType.totalRooms` (physical) is already the right base.
- ✅ **Keep all CM inventory/rate/restriction access going through `@revio/core`** (already the rule) so
  the CRS shares the same logic and data.
