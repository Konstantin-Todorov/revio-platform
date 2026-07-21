# RevioCRS — Refinement Review (Round 2)

> **Provenance.** Founder doc delivered 2026-07-20 (`Revio Development Docs (1).docx`). Its sibling file
> (`Revio Development Docs.docx`, title typo'd "RevioCRS") is actually the **RevioLink/CM** refinement —
> see `CM-REFINEMENT-R1.md`. This CRS doc repeatedly says to *match RevioLink / reuse RevioLink
> components*, so **CM is the finished reference** these bring CRS up to.
>
> **Authority.** A *refinement* pass on top of the shipped V2 CRS (`CRS-GUIDE-V1.md`, tasks C1–C11).
> Conventions from the main guide still hold — most importantly the **two-tier precedence model**
> (date-scoped edits resolve by recency, §1.4 of the main guide) and **one shared bulk engine + one audit
> path** (never a parallel implementation). Where a change touches derived-rate logic or precedence, the
> `[build note]` flags the constraint to honour.
>
> **Shared components.** Inventory Calendar (§5), Bulk (§7), and Rooms & Rates linkage (§6) are the **same**
> changes as the RevioLink refinement — build them as shared components reused across both products.
> **Note:** the CM Dashboard's "Reservation Summary card" is a CM-only ask (not requested for CRS here);
> the CRS Dashboard's change is the YoY/LW comparison model below.

---

## 1. Dashboard

### 1.1 Label what each delta compares against
Each KPI shows its change as `+X%pp` without saying against what. Add the **comparison-basis label** next
to the delta — "YoY" or "LW" (e.g. `+3.2%pp YoY`).

### 1.2 YoY / Last-Week (LW) toggle
A single toggle **YoY / LW** sets the comparison basis for the **whole dashboard**; every card's delta and
label update together.
- YoY = same period last year; LW = the prior week.
- `[build note]` **YoY = 364 days back** (52 weeks) to keep day-of-week aligned (STLY convention, main
  guide §4.2) — **not** 365. **LW = 7 days back**. One toggle governs all cards; **persist per user**.

---

## 2. Analytics — full redesign

### 2.1 Keep
Date filters + global controls are correct — leave them (period presets, custom range, **Book-date vs
Stay-date** toggle, source filter, daily/weekly/monthly granularity). This changes **how results are
visualised**, not which metrics the CRS computes.

### 2.2 Problem being fixed
Selecting a period currently renders **one row per day** — a raw table. Replace it as the *primary* view
with a **summary dashboard** that aggregates the period and shows its evolution, in the same summary style
the homepage dashboard already uses.

### 2.3 Metric summary cards (period totals)
One summary card per metric for the selected period — the period aggregate, mirroring the homepage cards:
**Occupancy, ADR, RevPAR, Revenue, Room-nights** (plus any others on the homepage). Each carries the
**YoY/LW delta** with the same green-up / red-down treatment as §1.
- `[build note]` Ratios are **recomputed from summed numerator/denominator** (occupancy = Σsold/Σavailable,
  ADR = Σrevenue/Σsold) — **never averaged across days**.

### 2.4 Evolution bar charts
Below the cards, each metric's **evolution across the period as bar charts** at the selected granularity
(daily/weekly/monthly). The **Book-date vs Stay-date** toggle governs how cards *and* charts are computed.

### 2.5 Performance by room type
A **Performance by room type** section — per room type, for the period:
- Room-nights · Revenue · Booking window (avg lead time) · ADR · Cancellation (rate/count)

Laid out so room types compare against each other (table and/or per-metric bar chart). This is the
concrete build of the "Room-type & Rate-plan performance" sub-tab flagged in main-guide §3.2.

### 2.6 Keep raw day-level data
Retain the per-day table as a **drill-down / export**, not deleted; the summary dashboard becomes primary.

---

## 3. Reservations — sortable columns

### 3.1 Three-click sort cycle
Add sort controls to each column: **Guest / Stay / Room / Source / Total / Status / Booked**. Clicking a
column cycles: **1st → ascending · 2nd → descending · 3rd → back to default (chronological)**.
- `[build note]`
  - **Single active sort** — clicking a new column resets the previous one to unsorted; only one sorts at
    a time.
  - **Define the default order explicitly** (e.g. Booked date, newest first) so "third click returns to
    initial" is deterministic.
  - **Per-column sort keys**: Guest (surname/alpha), Stay (check-in date), Room (room type then
    number/assigned room), Source (alpha), Total (numeric), Status (**lifecycle order** Draft → Hold →
    Confirmed → Archived, not alpha), Booked (reservation-made datetime).
  - Sorting operates on the **current filtered result set** (respects active filters incl. Date-type) and
    is **display-only** — never mutates data.

---

## 4. Guests — Notes surface

### 4.1 Notes tab on the guest page
A **Notes** tab where an agent can add, save, and edit notes for a guest.
- `[build note]` **Multiple notes per guest**, each with **timestamp + author** (which staff member
  wrote/last-edited it). Editing keeps at least last-edited author + time. Notes attach to the **shared
  guest record** (persist with the guest). **Decide + document visibility scope** — CRS-only vs visible
  wherever the guest record appears (e.g. PMS) — and apply it consistently. Keep it a **light operational
  free-text aid** ("not a CRM" scoping).

> **BUILT (H7, 2026-07-21).** New `GuestNote` model on the shared core (`guestId` + `tenantId` + RLS),
> newest-first, add/edit/delete server actions with the author taken from the session (never
> client-supplied). **Visibility decision: shared-core, not CRS-only** — notes hang off the core `Guest`
> and carry `tenantId`, so they surface wherever that guest appears (CRS today, RevioPMS once the property
> runs it). Surfaced as a "Notes" card on the guest detail page (`edited` badge when updatedAt > createdAt).

---

## 5. Inventory Calendar — align to RevioLink

### 5.1 Match RevioLink's view filters (date + products)
Give the CRS Inventory Calendar the **same date + product view filters** as the RevioLink calendar — date
range/navigation, product filters (room-type + rate-plan multi-select by name), collapse/expand-all.
**Reuse the RevioLink components** so behaviour is identical. (Keep the CRS availability waterfall intact.)

### 5.2 Bulk edit opens in a modal **over** the calendar (no navigation away)
The bulk-edit action opens the bulk tool in a **modal on top of the calendar**, calendar still visible
behind it. On apply the user **stays on the calendar** (no redirect) — edit, scroll to the next room,
repeat.
- Modal is **pre-scoped** to the row it was launched from.
- On apply it closes (or shows the result, §7.2) and the calendar stays exactly where it was.
- `[build note]` This modal calls the **same bulk engine** as Bulk Rates & Availability (§7) — same
  fields, same validation, same audit entry. **One tool, two entry points.** Same preview→apply→result
  behaviour (§7.2).

### 5.3 Remove "derived rates" from the display filter
Rate-row visibility is governed **solely by the rates filter** (rate-plan multi-select). Derived status is
shown **inline** instead (§5.4).

### 5.4 Paperclip icon on derived rate rows
A small **paperclip** at the start of each derived rate's row marks it derived. Manual rates: no icon.
Recommended: **hover shows parent + offset** (e.g. "Standard − 10%").

### 5.5 Hide the top search bar in calendar view
Suppress the global search bar when the calendar view is active (it remains on other screens).

---

## 6. Rooms & Rates

### 6.1 Vertical restack (rooms on top, rate plans below)
Layout changes from rooms-left / rates-right to **stacked**: **rooms on top, rate plans below**, both as
**collapsible rows** with a **per-row toggle + a single expand/collapse-all**.
- Expanding a **room** shows its assigned rate plans (linkage quick-view).
- Expanding a **rate plan** reveals its settings (pricing, policies/defaults, derived linkage — §6.2).
- `[build note]` Reuse the collapse/expand-all interaction from the Inventory Calendar. **Verify current
  state first** — the fuller doc says "vertical restack assumed already done"; the shorter doc specs it as
  new. If C7 already stacked it, this is a no-op.

### 6.2 Make Rate Plan Linkage **editable** (was read-only)
The user can **edit** an existing relationship (change parent or offset) and **add** a new relationship to
existing rate plans — so a derived-rate rule can be created **both at creation time and afterwards**.
- `[build note]` — guardrails (touches the derived-rate engine):
  - **No cycles.** Reject circular links (A→B→A) and self-reference (A→A) on save, with a clear message.
  - **Recalculate on change.** Editing parent/offset recalculates the child's derived values across
    affected dates, through the **same recalc path used at creation** — no stale values.
  - **Manual parent only.** A derived rate's parent must ultimately resolve to a manual rate. If chains are
    allowed (A→B→C), enforce a **max depth** and walk the chain in order.
  - **Respect precedence.** Derived values stay subordinate to date-scoped edits under the two-tier model —
    making a rate derived doesn't override a more-recent manual date-scoped value; §1.4 resolution still
    governs display.
  - **Existing data.** When linkage is added to a rate plan that already has values, **decide + document +
    surface to the user before saving** whether existing manual values are overwritten by the newly-derived
    values or preserved until next edit.

---

## 7. Bulk Rates & Availability

### 7.1 Multi-field editor (replace the "Edit type" dropdown)
Replace the single-attribute dropdown with a **form of fields for every editable attribute**, so several
can be set in one pass. Fields (full ARI set the tab supports):
- Rate / price · Minimum stay (min LOS) · Maximum stay (max LOS) · Closed to arrival (CTA) · Closed to
  departure (CTD) · Min / max advance booking · Rate-plan status open/close (stop-sell)

Any subset may be filled; empty fields untouched. **Validation: ≥ 1 field must have a value**, else block
Apply and prompt.
- `[build note]` Date-scoped edits over the range, resolving by recency under the two-tier model. **One
  apply = one audit entry** recording every attribute changed. Only **manual** rates are directly
  price-editable; a **derived** rate's price recalculates from its parent (disable/ignore the price field
  for derived rows; restrictions + open/close still apply).

### 7.2 Preview & Apply → confirm-then-result modal
Preview & Apply opens a modal **summarising every update** (room types / rate plans, date range,
attributes + values) with an **Apply** button.
- User reviews → clicks Apply → **only then** are updates written.
- Success: green **"Successful"** + short summary. Failure: red **"Not successful"** + short summary of
  what failed (and why, where known).
- Dismiss via **X or backdrop** in both cases.
- `[build note]` **One shared modal pattern** (preview → apply → result, X/backdrop, green/red). **Reuse
  for the calendar bulk modal (§5.2)** so both entry points behave identically.

### 7.3 Rename "Restriction Rules" → "Your active restriction rules"
Label rename only; no behaviour change.

---

## 8. Settings

### 8.1 Low availability alert threshold (new)
A box where the user types the number of available units that triggers the alert (e.g. `1` fires when a
room type's availability for a date reaches that level).
- `[build note]` Evaluate **per room-type, per date**: trigger when remaining availability is **≤** the
  threshold (not strict `==`, so a multi-room booking that jumps past the exact value still fires). A
  **single property-level threshold** across room types. Surface where the dashboard already handles alerts
  (Action Center / notifications). Keep the rest of the standing policy defaults as-is (min-stay,
  cancellation policy, booking windows, hold TTL, gross/net, pickup window, no-shows-as-sold).

### 8.2 Staff — user management (on the shared identity)
The Staff tab gains full CRUD: **add a user, assign a role, deactivate, update role, reset password, change
email/phone**.
- `[build note]` — **one shared identity** (important): all of this operates on the **single shared-core
  identity used across every Revio product** — not a CRS-local user table. "Add a user" invites/creates the
  shared identity (scoped to this property/role); "reset password" acts on the shared credential; "change
  email" changes the shared login contact (flag if email is the login identifier). **This supersedes the
  earlier note that user assignment happens only in RevioLink** — user management is now surfaced in each
  product, all acting on the one identity. **Do not create divergent user stores.** Roles come from the
  role×permission matrix in Settings. Prefer **deactivate over hard-delete** (audit trail). Password reset
  uses shared auth (emailed reset link preferred over plaintext temporary password).

> **BUILT (H8, 2026-07-21).** The read-only Staff card is now full CRUD on the **one shared `User`
> identity** (`apps/reservation/lib/actions-users.ts` + `components/settings/StaffManagement.tsx`): add
> (invite), inline role change, deactivate/reactivate (preferred over hard-delete — no delete offered),
> reset password (demo → shared demo password; production → emailed reset link), and edit name/email/phone.
> Added a nullable `phone` to the shared `User` model (migration `20260721180000_user_phone`) so
> "change email/phone" acts on the one identity. Owner/Admin-gated; guards the last active owner and
> self-deactivation. **§8.1 low-availability threshold was already built** (Settings input → dashboard
> Action Center, evaluated per room-type/date with `≤`, `metrics.ts`).

---

## 9. Cross-cutting consistency
- **One bulk engine** behind the calendar modal (§5.2) and Bulk Rates & Availability (§7): same fields,
  same ≥1-field validation, one audit entry per apply.
- **One modal pattern** for both bulk entry points: preview → Apply → green/red result, dismiss via
  X/backdrop.
- **One comparison model** across Dashboard + Analytics: YoY/LW basis, %pp + basis label, green-up/red-down.
- **One shared identity** behind every user-management surface (CRS Staff, RevioLink, PMS).
- **Paperclip = derived** wherever rates are listed — same meaning everywhere, not only the calendar.
- **Shared formula sheet** feeds Dashboard + Analytics — they must agree to the cent for the same period
  and basis.
