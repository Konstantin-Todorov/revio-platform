# RevioPMS — Developer Reference (V1 scope, 2026-07-04)

> Drafted from `apps/pms/CLAUDE.md` + the platform architecture (there was no founder .docx for PMS, unlike
> `CRS-REFERENCE.md`), then **confirmed with the founder 2026-07-04** — the §0 decisions are settled (see
> the ✅ marks). This is now the canonical spec for `apps/pms`, built the same phased way as the CRS.

## What the PMS is (vs CM and CRS)

- **CM (RevioLink)** answers *"is my ARI syncing correctly?"* — pure distribution plumbing.
- **CRS (RevioCRS)** answers *"how is the property selling?"* — owns the **reservation record** (every
  booking from any source) and the performance metrics.
- **PMS (RevioPMS)** answers *"how is the property being run today?"* — owns **operations**: which
  physical room a guest is in, whether it's clean, what's on their bill, who's arriving. It is the
  **system of record for operations, not for bookings** (that's the CRS) and not for ARI (that's the CM).

The PMS is the layer that finally makes the CRS reservation lifecycle states **Checked-in → Checked-out
→ Archived** reachable (the CRS spec marks them *"future — needs PMS connection"*; RevioPMS **is** that
connection). It sells as a standalone operations layer even over a foreign reservation system, but on our
platform it reads/writes inventory **only** through `@revio/core`, exactly like CM and CRS.

## The one genuinely-new concept the PMS introduces: **physical Units**

CM and CRS manage inventory as **counts per room type** ("6 Double Rooms available on this date"). The PMS
is the first product that cares **which** Double Room — room 101 vs 102 — because you can't clean, assign a
key to, or post a minibar charge against "a count". So the PMS adds a **Unit** (a physical, addressable
sellable unit under a RoomType) and everything operational hangs off it.

- **Sellable Unit abstraction** (already named in `apps/pms/CLAUDE.md`): a Unit is a **room** for hotels
  and a **bed** for hostels — same table, `unitKind: room | bed`. **V1 proposal: build rooms-first**,
  keep the model bed-capable so hostels are a later config flag, not a rewrite.
- **Units never change the availability math.** RoomType count stays the source of truth for what's
  *sellable*; Units are an operational overlay of the same capacity. Marking a Unit **Out of Order** in the
  PMS writes a CRS **`RoomInventoryPeriod` (OOO)** for that RoomType/date-range → the shared **availability
  waterfall** takes one room off sale on every OTA on the next CM push. One integration, no new math.

## V1 scope (proposed)

✓ **Units & Housekeeping** (physical rooms, statuses, task board, mobile PWA) ·
✓ **Front Desk** (arrivals/departures/in-house, check-in with room assignment, check-out, walk-in, room move) ·
✓ **Folio & Billing** (per-stay bill, post/void charges, record payments as labels, balance, settle at check-out) ·
✓ **Minibar / POS-lite** (chargeable-item catalog → post to folio, mobile) ·
✓ **Maintenance / Tasks** (basic: task against a unit, assign, status; unit→OOO)

**Not V1 (proposed):** real **payment processing / card storage** (record payments as labels + amounts
only — see §0.3, consistent with the platform's card-data prohibition and the CRS "payment guarantee =
label" rule); **lock/key hardware** integration (label/placeholder only — depends on the hotel's access
type); channel/OTA config (stays in CM); revenue metrics (stay in the CRS formula sheet); CRM/loyalty
(Guests stay a CRS contact record); automated night-audit posting (V1 = a **manual** day-close; see §0.4);
full restaurant/retail POS; group/allotment operations; travel-agent commission ledgers.

## 0. Settled decisions (confirmed with the founder 2026-07-04)

1. ✅ **Rooms-first, hostel-beds later.** Model is `unitKind: room | bed` from day one; V1 UI/flows assume
   rooms. Dorm-bed selling is a later config flag, not a rewrite.
2. ✅ **The PMS introduces individual Units** — a PMS-owned table (only meaningful with operations) that
   lives in the shared schema with `tenantId`+RLS, so a future CRS "assign room at booking" could read them.
3. ✅ **Payments = labels + balance only in V1.** No gateway, no card data — record method label + amount,
   compute the folio balance, gate check-out on settlement (manager override). Matches CRS + the platform
   rule that we never handle card data. A real terminal/gateway is a future integration.
4. ✅ **Night audit = a manual "Close Day" action** per property (posts that night's room charge to open
   folios, lists un-arrived reservations for a no-show decision, rolls the business date in property TZ).
   Unattended nightly automation is a later phase, alongside the shared scheduler infra.
5. ✅ **Guest data reuses the CRS `Guest`** record (contact + booking history); the PMS adds only the
   operational registration fields (ID/passport doc ref, address for the reg card) — **not** a second guest
   store. (Exact reg-card fields to capture: finalize at Phase 2 against the property's legal requirement.)

## Data model (proposed additions — all `tenantId` + `tenant_isolation` RLS)

```
Property
├── Room Type (existing) ──< Unit          physical room/bed: number/label, floor/zone, kind, sortOrder, active
│                              └── UnitStatus (housekeeping): Clean | Dirty | Inspected | Out-of-Order (+ occupancy derived)
├── Reservation (existing) ──< RoomAssignment   a ReservationLine ↔ Unit for a date range (supports room moves)
│        └── Stay lifecycle: Reserved → In-house → Departed  (realizes the CRS "checked-in/out" states)
├── Folio (per reservation/stay) ──< FolioLine   type: accommodation | minibar | fee | tax | payment; amountMinor; postedAt; desc; ref
├── PosItem (charge catalog)                     name, priceMinor, category (minibar/extra), taxable
├── HousekeepingTask                             unit?, type (clean/inspect/turndown), status, assignee, notes
└── MaintenanceTask                              unit?, description, status, assignee → may set the unit OOO
```

**Reuse, do not duplicate:** RoomType, Reservation/ReservationLine, Guest, RoomInventoryPeriod (OOO),
TaxFee, PropertyDefaults, PermissionRole — all already exist from CM/CRS. The PMS adds **only** the six
tables above. The availability waterfall, the metrics formula sheet, and per-OTA config are **not**
re-implemented here.

## System rules & business logic (the section to check first)

### Housekeeping status model (per Unit)
- **Housekeeping status:** `Clean → Dirty → (Cleaned) → Inspected → Clean`, plus **Out-of-Order** (blocks
  assignment *and* writes a CRS OOO period so it leaves sale).
- **Occupancy status** is **derived**, never stored: `Occupied` if an in-house RoomAssignment covers
  tonight, else `Vacant`. So a room is e.g. "Occupied / Dirty" or "Vacant / Clean".
- **Check-out sets the unit Dirty**; housekeeping flips it Clean; an optional supervisor step flips it
  Inspected before it's assignable again (toggle in Property Defaults — some hotels skip inspection).

### Front-desk flows
- **Check-in** = pick a confirmed reservation whose arrival is today (property TZ) → assign a **Clean/
  Inspected, Vacant** Unit of the booked RoomType → mark the stay **In-house**. Room must match the booked
  type unless an explicit **upgrade/downgrade** override is chosen (logged). Never assign an OOO/Dirty unit
  without an override.
- **Walk-in** = create a reservation on the spot **via the CRS** (`@revio/core`, same Hold→Confirm path —
  the PMS never invents a second booking path) then immediately check it in.
- **Room move** = end the current RoomAssignment, open a new one on the target Unit; old unit → Dirty.
- **Check-out** = settle the folio (balance 0 or manager override) → stay **Departed** → unit **Dirty** →
  reservation lifecycle → `Checked-out`.
- **No-show** = a not-arrived reservation past its arrival date; the front desk (or the day-close) marks it
  → hands off to the CRS `No-show` status (which already gates on "after check-in date"). Inventory the
  CRS already released on the stay window stays consistent.

### Folio rules
- **One open Folio per stay.** Accommodation lines are the authoritative **reservation rate** (same source
  the CRS Room-Revenue metric reads — so PMS bills and CRS reports never disagree); extras/minibar/fees are
  new PMS lines. **Balance = Σ charges − Σ payments** (all integer minor units + currency, never floats).
- **Payments are labels + amounts only** (no card data). Voids are logged, not deleted (audit).
- Check-out is blocked on a non-zero balance unless a permitted role overrides (reason logged).
- Taxes/fees reuse the CRS **`TaxFee`** config so a fee is defined once for the property.

### Shared-platform invariants (unchanged)
- **Availability waterfall lives ONCE in `@revio/core`.** PMS OOO → `RoomInventoryPeriod` → waterfall →
  CM push. PMS never writes availability directly.
- **Metrics live ONCE in `@revio/core`** (the CRS formula sheet). PMS shows **operational counts**
  (arrivals/departures/in-house/dirty rooms) — it does **not** compute occupancy/ADR/RevPAR itself.
- **All date logic uses the property's time zone** (business date, "arrivals today", day-close, OOO ranges).
- **Guests** = the CRS `Guest` record + reg-card fields; no second guest store, no CRM.

### System jobs (background)
| Job | Frequency | Notes |
| --- | --- | --- |
| **Day close / night audit** (post night's room charge to open folios, flag un-arrived → no-show, roll business date) | nightly per property TZ | **V1 = manual "Close Day" button**; automate later with the shared scheduler |
| Auto-Dirty on stored check-out date passing | with day close | keeps housekeeping honest if a check-out wasn't clicked |
| Archive departed stays / old tasks | daily | terminal housekeeping state, never affects live counts |

## Sitemap (proposed)

**Front Desk** (Arrivals · Departures · In-House · Check-in · Check-out · Walk-in) ·
**Rooms** (Room Rack / floor view · Unit list & setup · Housekeeping board) ·
**Housekeeping** (Task board · My tasks — mobile PWA · Supervisor inspection) ·
**Folios** (open bills · post charge · payments · settle) ·
**Minibar / POS** (catalog · quick-post — mobile) ·
**Maintenance** (task list · create · assign) ·
**Reports** (Housekeeping productivity · In-house list · Arrivals/Departures manifest · Charge summary) ·
**Settings** (Units setup · POS catalog · Day-close · Users & Permissions — reuses the CRS role matrix,
add a `Housekeeping`/`Front Desk`/`Folio` permission group) · **[Global Search]**

### Screen notes (the non-obvious ones)
- **Room Rack** — the front-desk hero view: units (rows) × dates (cols), each cell showing the assigned
  stay + housekeeping colour; drag to assign/move. Read from RoomAssignment + UnitStatus, not re-derived.
- **Housekeeping board** — units grouped by floor/zone, one-tap status change, assignment to a housekeeper;
  the **mobile PWA** (not a native app) is the primary surface for housekeeping/minibar roles.
- **Check-in** surfaces only assignable units (Clean/Inspected, Vacant, right type) with an override path.
- **Minibar quick-post** — housekeeper selects a unit + items → posts to that stay's folio in one screen.
- **Users & Permissions** — extends the existing CRS permission-group matrix (None/View/Edit) with
  operations groups; built-in V1 roles gain **Front Desk Agent** and **Housekeeper** (mobile-scoped).

## How it fits OUR platform (the binding decisions)

1. **One database, one core.** PMS is a fourth lens over the same rows (Property, RoomType, Reservation,
   Guest, RoomInventoryPeriod, TaxFee…). It adds six operational tables; it re-implements no domain math.
2. **`hasPms` entitlement** gates it (Operator Console toggle — same pattern as `hasReservation`).
3. **Fourth Next app** `apps/pms` (proposed port **3003**, cookie `revio_pms_session`), same shell/auth/
   session choke point, same Railway service pattern (own build/start `--filter`, shared Postgres).
4. **Operations connect to bookings, not to OTAs.** PMS never talks to a channel; it consumes CRS
   reservations and writes operational state back. When a stay checks in/out, the CRS lifecycle advances.
5. **OOO is the one write that leaves the PMS**: Unit-OOO → `RoomInventoryPeriod` → waterfall → CM push.
6. **RLS Phase 2 stays LAST** — the PMS tables get their `tenant_isolation` policies in the same final
   prod-enforcement pass that covers CM + CRS (per `DEPLOY.md`), so one migration hardens everything.

## MVP build order (proposed — mirrors how CRS was phased)

1. **Units & Housekeeping foundation** — `Unit` under RoomType (+ seed units for the demo hotels), the
   housekeeping status model, the board + mobile PWA, **Unit-OOO → CRS `RoomInventoryPeriod` wired to the
   waterfall from day one** (the one cross-product write — prove it early like the CRS pickup job).
2. **Front Desk** — arrivals/departures/in-house, check-in (room assignment) / check-out / walk-in / room
   move; realize the CRS Checked-in/out lifecycle states.
3. **Folio & Billing** — one folio per stay, post/void charges, record payments (labels), balance,
   settle-at-check-out gate; reuse CRS `TaxFee`.
4. **Minibar / POS-lite** — charge-item catalog + mobile quick-post to folio.
5. **Maintenance/Tasks + day-close + reports** — task board (unit→OOO), the manual **Close Day** action,
   operational reports (housekeeping productivity, in-house, arrivals/departures manifest, charge summary).

A unit isn't operable until it exists under a RoomType with a housekeeping status; a property isn't
"PMS-ready" until its RoomTypes have Units and (optionally) a POS catalog.
