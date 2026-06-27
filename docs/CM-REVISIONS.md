# RevioLink — V2 Revisions (founder spec, 2026-06-27)

Faithful capture of the founder's "RevioLink – Updates" doc, organised for engineering with a
**model-impact tag** on each item and whether it **blocks real connectivity**. This is the source of
truth for the next wave of CM work; sequencing lives in `BUILD-PLAN.md`.

Tags: **[MODEL]** changes data model / core semantics · **[UI]** screen feature · **[IA]** navigation /
information-architecture move · **[INFRA]** needs a new capability (e.g. email sending). 🔌 = the
Channex/real-connectivity wiring depends on this, so it should land **before** we wire Channex.

---

## ⚠️ Three architectural decisions to confirm FIRST (everything else builds on these)

1. **Inventory becomes date-level; room types hold only "Total Number of Rooms" (physical).** [MODEL] 🔌
   Today availability = `RoomType.totalInventory − confirmed` (with optional `DailyCell` override).
   New model: the **per-date inventory IS the managed number** ("rooms to sell" per date), and
   `Total Number of Rooms` is a **physical safety-net only** — if a date's inventory exceeds it, show a
   non-blocking "Attention: loading more than physical rooms" prompt. "Rooms Sold" is shown separately,
   derived from reservations. → Changes `@revio/core` availability, `RoomType` schema, the seed, and
   every calendar read/write. **Biggest change — do first.**

2. **Currency lives on the Property; channels inherit it.** [MODEL] 🔌
   Remove the per-channel currency setting. Property has one currency, reflected across the calendar.
   Changing it prompts *"Convert all existing rates?"* → if yes, ask for an exchange rate and convert
   every rate on every date; if no, only the displayed symbol changes (values unchanged). → Touches
   `Channel`/`Property` schema, Channels UI, Settings, calendar display, and what we send to Channex.

3. **Mapping splits into two independent streams: Room Types and Rate Plans.** [MODEL] 🔌
   Room-type mappings drive **inventory + open/close**; rate-plan mappings drive **rates + restrictions**
   — different connectivity streams. This **mirrors Channex exactly** (`room_type_id` → availability;
   `rate_plan_id` → rates/restrictions, confirmed in the live sandbox test). Restructures
   `ProductMapping`. **Do before wiring Channex so we wire it once.**

---

## Dashboard
- Per-channel **quick actions** on each channel row: **Disconnect · Close/Open all dates · Re-sync**. [UI] 🔌
  (Meaningful only against a real channel; stub on mock.)

## Calendar
- Show **all room types** in the grid (not selected via top tabs). A **top-left dropdown** expands/collapses
  each room type; collapsed shows room type, open/closed per date, and rooms-to-sell. [UI]
- New **"Number of rooms sold"** row per date / room type (derived from reservations). [MODEL]
- **Filters (top):** Select Room Types · Select Rate Plans (both temporary, reset on leave, default = all);
  per-room-type **Bulk Edit** button (rate plan + inventory / open-close / rate per 1-pax,2-pax /
  restrictions); **Customise Display** toggles: Rates · Inventory · Restrictions · Rooms Sold. [UI]
- **Navigation & range:** manage inventory/rates for the next **2 years**; default **30-day** view with
  **Prev/Next** arrows; custom **Start/End** date fields, capped at a **30-day** window for readability. [UI]
- **Bulk Update merges with Restrictions:** Restrictions becomes fields inside the Bulk Update mask. Bulk
  Update controls all calendar rows **except "Rooms Sold"**. [IA]

## Rooms & Rates
- Room type: **remove the Inventory field**; add **Total Number of Rooms** (physical safety-net, see
  decision #1). [MODEL]
- Rate plan: add **Minimum Stay / Maximum Stay** (rate-plan level — sent for all dates, not date-editable),
  and **Advance Purchase Restriction (Min/Max days)** with **rolling auto-close** (Min 3 → close next 3
  days from today rolling; Max 3 → close everything beyond the next 3 days, rolling). [MODEL]
  *(Schema already has `defMinLos/defMaxLos/defAdvancePurchase*`; mostly UI surface + the rolling-close
  logic in core.)*
- New tab **Rate Plan Linkage** — configure derivative pricing between rate plans + a simple graphical
  overview of active linkages (e.g. `BB → BB NR → Mobile NR`). [UI] *(derived pricing already in model.)*

## Channels
- **Remove channel currency** (inherits property currency — decision #2). [MODEL]
- **Automatic currency conversion** function (ask exchange rate → convert all rates, all dates). [MODEL]
- Per-channel **quick actions** (Disconnect · Close/Open all dates · Re-sync). [UI] 🔌
- **Channel logos**; keep **Mapping Completeness**; add **"Connectivity Health – Last 24h"** bar (% of
  updates delivered successfully; flag anything below 100%). [UI] 🔌

## Mapping — split into two sections (decision #3) 🔌
- **Room Types:** left = CM room types; right = OTA-pulled room types + per-row dropdown mapping + OTA
  product code. Controls **inventory + open/close**. [MODEL]
- **Rate Plans:** same layout. Controls **rates + restrictions**. [MODEL]

## Reservations
- **Filters (top), cross-filtering:** Channel (multi; none selected = all) · Reservation Number (free text,
  comma-separated) · **Date Type** dropdown (Check-in / Check-out / Booking / Cancellation / Stay-in) ·
  Begin/End date (mini calendar). Behaviour per the spec; filters combine (AND). [UI]

## Sync Center (consolidation) [IA]
- Add a scrollable **Logs** tab; filter by channel; colour-coded (green = success, red = fail).
- **Merge Error Centre into Sync Center** (errors become a dashboard section at the top).
- **Move Audit Log under Sync Center.**

## Settings
- Add **Total Number of Rooms** and **Currency** (property default; conversion prompt per decision #2). [MODEL]
- **Reservation Delivery:** Primary + Secondary reservation email (all reservations sent here when no
  direct PMS connection). [INFRA — email sending]
- **Notifications:** Today's Arrivals + Tomorrow's Arrivals — toggle, choose primary/secondary email,
  choose send time (scheduled summary email). [INFRA — email + scheduler]

## User Management [IA]
- **Remove from Settings; move to its own item in the main nav under Operations.** (Quick win.)
