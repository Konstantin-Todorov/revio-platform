# RevioCRS — Developer Reference (founder spec v2, 2026-07-02)

> Source: founder .docx "Central Reservation System — Developer Reference" (supersedes the 2026-06-27
> capture — same skeleton, now with exact formulas, lifecycle, rules, and build order). This file is the
> canonical spec for `apps/reservation`. The final section maps it onto OUR shared-core platform.

## What the CRS is (vs the CM)

The CM answers *"is my ARI syncing correctly?"* — pure plumbing, no commercial meaning.
The CRS answers *"how is the property actually selling?"* — it **owns the reservation data** (every
booking from any source is a record here) and calculates real performance metrics from that record.
**It is the system of record for bookings — not for hotel operations** (that's the PMS).

## Core architecture decision — one "Connected Channel Manager", always

- The CRS **never talks to an individual OTA directly — full stop.**
- Every property connects to **exactly one Channel Manager** (push ARI out, pull reservations back).
- **RevioLink is just the default value** of that connection, not a special case: partners with an
  existing CM (SiteMinder, RoomRaccoon, …) keep it. **One integration pattern, never two code paths.**
- Per-OTA configuration always lives inside whichever CM is connected, never in the CRS.
- Call Center / Direct / manual sources never go through a CM at all (staff-entered).

## V1 scope

✓ Reservations (create/modify/cancel, lifecycle, holds) · ✓ Inventory & Availability ·
✓ Rates & Restrictions · ✓ Distribution via the one connected CM · ✓ Reports & Dashboard ·
✓ Guests (contact + booking history only — **not** a CRM)

**Not V1:** PMS operations, housekeeping, check-in/out, folios/POS, payment processing, CRM/loyalty,
booking engine, revenue-management automation, AI forecasting. (Occupancy-based pricing, LOS pricing,
package rates, same-time-last-year pace, report email scheduling, tax age-exemptions: flagged future.)

## Data model

```
Property
├── Room Types → Inventory (DATE-SENSITIVE: base physical count + out-of-order periods + closure
│                periods, each with its own date range, separate from the permanent total)
├── Rate Plans → Policies (cancellation, meal) + Restrictions (+ scope by booking source)
├── Reservations → Guests (contact) + Holds (temporary inventory locks)
├── Booking Sources (reporting category each Channel belongs to)
├── Distribution → Connected Channel Manager (RevioLink or third-party)
└── Reports (CALCULATED from Reservations + Inventory — never stored separately)
```

Entity dictionary: Property · Room Type (→Property) · Rate Plan (→Room Type) · Reservation (→Property) ·
Guest (→Reservation) · Restriction (→Rate Plan, or →Property as fallback) · Hold (→Reservation) ·
Channel (→Distribution) · Booking Source (→Channel) · Connected Channel Manager (→Property).

## Core metrics — ONE formula sheet (Dashboard + Reports read the SAME calculation)

| Metric | Formula |
| --- | --- |
| Available Room-Nights | (Physical − Out-of-order − Closed) × nights in period |
| Rooms Sold (room-nights) | Σ (rooms × nights) for confirmed reservations overlapping period |
| Occupancy % | Rooms Sold ÷ Available Room-Nights × 100 |
| Room Revenue | Σ room-rate revenue, **accommodation only** (taxes/city tax/service/cleaning/extras excluded unless bundled into rate) |
| ADR | Room Revenue ÷ Rooms Sold |
| RevPAR | Room Revenue ÷ Available Room-Nights (= ADR × Occupancy) — the #1 hotel KPI |
| Cancellation Rate (headline) | Cancelled reservations ÷ total created × 100 (Dashboard card) |
| Cancelled Room-Night Rate | Cancelled room-nights ÷ gross booked room-nights × 100 (Cancellation Report — weights by stay length) |
| Pickup | Rooms sold for a future range NOW − rooms sold for same range at stored snapshot N days ago |
| Average LOS | Total booked room-nights ÷ reservations |
| Lead Time | avg(check-in date − booking creation date) |
| Channel/Source Mix | channel (or source) reservations-or-revenue ÷ total × 100 |

- **No-shows count as Sold** for occupancy/ADR/revenue by default (room was held; usually charged) —
  togglable Setting "Count no-shows as sold", default **yes**.
- **Gross vs Net revenue** (Net = Gross − channel commission) — display toggle, default **Gross**.
- Room-Night = one room × one night (2 rooms × 3 nights = 6 room-nights) — everything builds on it.

## System rules & business logic (the section to check first)

### Availability waterfall — single source of truth, never reimplement
```
Physical − Out-of-order − Closed            = Available Rooms
Available − Holds − Confirmed reservations  = Remaining Availability
```
(50 total, 2 OOO, 0 closed → 48 available; 1 hold, 35 confirmed → 12 remaining.)

### Reservation lifecycle
```
Draft → Hold → Confirmed ──(Modified = a FLAG on Confirmed, not a branch)
          │        ├── Checked-in → Checked-out → Archived   (future — needs PMS connection)
          │        ├── Cancelled
          │        └── No-show        (only reachable AFTER the check-in date has passed)
          ├── Expired  (hold timed out — released by background job)
          ├── Cancelled
          └── Failed   (validation failed before any hold was placed)
```
- **Draft**: optional multi-step entry (call center) — no inventory locked yet.
- **Hold**: inventory locks the instant a room is selected, before the form is saved — this is the
  overbooking-prevention mechanism (goal: overbooking *rare*, not "impossible"; residual race → Error Center).
- **Confirmed**: the only status counted in the metric formulas.
- **Archived**: terminal housekeeping state after a retention period; never affects live calculations.

### Modification rules — never a direct in-place edit
1. Release existing Hold/Confirmed inventory → 2. Validate the new room/dates → 3. Place new Hold →
4. Confirm → 5. Push updated availability to the connected CM.
**If step 2 fails, the original reservation stays untouched** — never release the old inventory until
the new is confirmed. Cancellation restores inventory immediately + pushes out.

### Restriction priority (most→least specific) — now FOUR levels
1. Manual edit on the Inventory Calendar → 2. Restriction Rule (date/source/channel-scoped) →
3. Rate Plan default → 4. **Property default (global fallback — new vs the CM's three levels)**.

### Currency — store all four at booking time
Original currency+amount · converted property-currency amount · FX rate used · conversion timestamp.
(Without rate+timestamp, historical reports become unreproducible when rates move.)

### Other rules
- **Rate inheritance**: derived rates recalc when parent changes unless a date has a manual override (same as CM).
- **Time zones**: ALL date logic (availability cutoffs, Dashboard "today", check-in/out, snapshots) uses
  the **property's** time zone — never server or browser. Critical for multi-property accounts.
- **Dashboard refresh**: recalc after reservation create/modify/cancel, inventory change, OOO change,
  date-filter change, property switch. Do NOT recalc on guest-note edits, role changes, etc.

### System jobs (background)
| Job | Frequency |
| --- | --- |
| Retry failed CM syncs | every 5 min |
| Release expired holds | every few min |
| Refresh exchange rates | hourly |
| **Pickup snapshot** (record today's Rooms Sold per future date) | nightly — stand up in Phase 1; can't backfill snapshots never taken |
| Archive old audit/sync logs | daily |

## Sitemap

Dashboard · **Reservations** (List · Create · Modify · Cancellations · Reservation Calendar ·
**Availability Search**) · **Availability & Rates** (Inventory Calendar · Bulk Update · Rate Plans ·
Derived Rates · Restrictions) · **Properties** (Profile · Room Types · Inventory Setup · Policies ·
**Taxes & Fees**) · **Distribution** (Connected Channel Manager · Channels · Mapping · Channel Rules ·
Sync Logs) · **Booking Sources** · **Guests** (Details · Booking History · Special Requests) ·
**Reports** (Performance · Pickup & Pace · Source · Cancellation · Availability) · **Sync Center** ·
**Error Center** · **Settings** (Property Defaults · Currency · Users & Permissions · Notifications ·
API/PMS Connection) · **[Global Search — reachable from anywhere]**

### Screen notes (the non-obvious ones)
- **Global Search**: by reservation ID, guest name, phone, email, arrival/departure, company, channel,
  room, status → returns reservations.
- **Dashboard**: date selector (Today/Tomorrow/7d/30d/MTD/YTD/custom) applies to every widget; top cards =
  Occupancy/Rooms Sold/Rooms Available/Room Revenue/ADR/RevPAR/Cancellation Rate/Pickup; charts (occupancy,
  revenue, source mix, pickup, cancellations, 30-day availability); operational tables (arrivals/departures
  today, new + cancelled reservations, low-availability dates, overbooking warnings, failed syncs);
  **Action Center** (prioritized alerts, every threshold a configurable Setting — never hardcoded);
  **Forecast** = same data read forward (expected occupancy/revenue/rooms/arrivals/departures, 7d + 30d) — NOT AI.
- **Availability Search** — the call-center entry point, a guest-stay-shaped query (arrival, departure,
  guests, optional room type) → Available/Not + lowest price + **alternative room suggestions** when full +
  **upgrade suggestions** at comparable price; flows straight into Create Reservation pre-filled.
- **Create Reservation** required fields incl. source, price, currency, cancellation policy, and a
  **payment guarantee method** — a label only ("card on file"/"company account"/"prepaid via OTA"/"none"),
  no card storage or processing in V1.
- **Reservation Timeline** on each detail page: the global Audit Log pre-filtered to one reservation
  (Created → Modified → Rate changed → … → Sent to CM).
- **Inventory Calendar** rows per room type: Physical / Out-of-order / Closed / Available / Sold /
  Remaining / Rates / Restrictions — all from the waterfall, never re-derived locally.
- **Restrictions** add **scope by booking source** (e.g. closed to Travel Agent, open to Direct).
- **Taxes & Fees**: per item — type (percent|fixed), basis (per room|person|night|stay), inclusion
  (included|excluded in displayed rate → feeds Room Revenue).
- **Booking Sources**: config screen mapping each channel to a category (Direct, OTA, GDS, Call Center,
  Corporate, Travel Agent); Corporate/Travel-Agent bookings are tagged at creation (no technical channel).
- **Guests** — hard scope line: contact details + this-CRS booking history + free-text special requests.
  No preferences system, no marketing consent, no loyalty, no cross-property history.
- **Reports**: every report exports CSV/Excel/PDF.
- **Settings → Users & Permissions**: **Permission Groups** (Reservations, Rates, Inventory, Restrictions,
  Users, Reports, Distribution, Finance) × access level (None/View/Edit); roles = saved combinations →
  new roles are configuration, not code. V1 roles: Owner (edit all), Admin (edit all except Finance),
  Revenue Manager (edit rates/inventory/restrictions/reports), Reservations Agent (edit reservations,
  view reports), Read-only.

## Performance targets (starting points, not commitments)

Reservation creation < 2s · Availability search < 1s · Dashboard < 3s · Bulk update async w/ progress ·
large reports as background jobs.

## MVP build order (the spec's own)

1. **Property & inventory foundation** — property setup, room types, physical counts, Inventory
   Calendar, waterfall logic, **+ the pickup-snapshot job now**.
2. **Reservations** — create/modify/cancel, list, Hold mechanism + lifecycle + hold-expiry job,
   availability reduction.
3. **Rates & restrictions** — rate plans, derived rates, calendar rates, LOS/CTA/CTD/stop-sell/AP.
4. **Dashboard & metrics** — the formula sheet, Action Center, Forecast.
5. **Distribution** — Connected CM setting, mapping, Sync Center, Error Center.

Optional **Property Setup Wizard** (or flat screens — equivalent): Property → Room Types → Inventory →
Rate Plans → Policies → Taxes & Fees → Connected CM. A property isn't bookable until all seven exist.

---

## How it fits OUR platform (shared core) — the binding decisions

*(Ours, not the spec's — agreed with the founder 2026-06-27; unchanged by v2.)*

1. **One database, one core.** CRS and CM are two lenses over the SAME rows (Property, RoomType,
   RatePlan, Reservation, DailyCell…). The CRS "pushes to the connected CM" — when that CM is RevioLink,
   the connector is **internal** (same DB): push is a no-op/notification, not a network call.
2. **`ChannelManagerConnector` adapter** in `@revio/core` — parallel to `ChannelAdapter`:
   `RevioLinkInternalConnector` (shared core, no network) + third-party impls (push/pull) later.
   The CRS never talks to an OTA; RevioLink owns per-OTA work.
3. **Availability waterfall lives ONCE in `@revio/core`** — extends `computeAvailability`. Today's CM
   model (DailyCell.inventory defaulting to totalRooms) collapses Physical−OOO−Closed into one editable
   number; the CRS makes **OOO and Closed explicit dated records** and adds **Holds**. Evolution:
   `remaining = (physical − ooo − closed) − holds − confirmed`, with the CM's "rooms to sell" as the
   manual override layer. Additive — no CM rewrite.
4. **New tables the CRS adds** (all with `tenantId` + `tenant_isolation` RLS policy): Hold,
   RoomInventoryPeriod (OOO/closure ranges), BookingSource, TaxFee, Guest, PickupSnapshot,
   PropertyDefaults (restriction fallback), PermissionGroup/RoleAccess.
5. **Same shell/auth/tenancy/entitlements**: `apps/reservation` = third Next app, `hasReservation`
   gates it (Operator Console toggle already exists), same session choke point, same Railway pattern.
6. **The 4 currency fields already exist** on Reservation (CM Phase 1b did this for CRS compatibility).
7. **Property-default restrictions** (priority level 4) — small addition, also benefits the CM.
