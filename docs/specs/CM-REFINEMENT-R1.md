# RevioLink (Channel Manager) — Refinement Review (Round 1)

> **Provenance.** Founder doc delivered 2026-07-20 (`Revio Development Docs.docx`). The file's **title
> reads "RevioCRS" — that is a typo; the doc is for RevioLink/CM** (founder-confirmed 2026-07-20). Its
> content refines screens CM already has (Calendar, Bulk, Rooms & Rates, Dashboard, Reservations); the CRS
> refinement doc (`CRS-REFINEMENT-R2.md`) separately tells the CRS to *match RevioLink*, which only makes
> sense if RevioLink is the reference — confirming the attribution. **Founder is re-sending the corrected
> file; reconcile this spec against it when it lands.**
>
> **Authority.** Refinement pass on the shipped V2 CM (`CM-GUIDE-V2.md` + `CM-UPDATES-V1.md`, tasks
> B1–B10). Conventions from the main guide hold — the **two-tier precedence model** (date-scoped edits
> resolve by recency) and **one shared bulk engine + one audit path** (never a parallel implementation).
>
> **Shared components.** The Calendar (§2), Bulk (§3), and Rooms & Rates (§4) changes are the **same** as
> the equivalent CRS refinements — build them as **shared components reused across both products**, so a
> paperclip means "derived" and a bulk modal behaves identically everywhere. CM screen names in brackets.

---

## 1. Dashboard

### 1.1 Reservation Summary card (new)
A small card showing, for the selected day, **new reservations** and **cancelled reservations**, with a
**Today / Yesterday** toggle.
- New = reservations created that day (by reservation-**made** date).
- Cancelled = reservations cancelled that day (by **cancellation** date).
- The toggle switches the whole card Today ↔ Yesterday.
- `[build note]` Counts by **action date** (made / cancelled), **not** stay date — the same date-basis
  logic as the Reservations "Date type" filter. Reuse that logic; don't count by check-in. (CM
  reservations are the read-only imports pulled back from channels.)

---

## 2. Calendar  *[CM screen: "Calendar"]*

### 2.1 Bulk edit opens in a modal **over** the calendar (no navigation away)
The bulk-edit action opens the bulk tool in a **modal on top of the calendar**, calendar still visible
behind it. On apply the user **stays on the calendar** (no redirect) — edit, scroll to the next room,
repeat.
- Modal is **pre-scoped** to the row it was launched from.
- On apply it closes (or shows the result, §3.2) and the calendar stays exactly where it was.
- `[build note]` This modal calls the **same bulk engine** as the Bulk screen (§3) — same fields, same
  validation, same audit entry. **One tool, two entry points.**

### 2.2 Remove "derived rates" from the display filter
Rate-row visibility is governed **solely by the rates filter** (rate-plan multi-select). Derived status is
shown **inline** instead (§2.3).

### 2.3 Paperclip icon on derived rate rows
A small **paperclip** at the start of each derived rate's row marks it derived. Manual rates: no icon.
Recommended: **hover shows parent + offset** (e.g. "Standard − 10%").

### 2.4 Hide the top search bar in calendar view
Suppress the global search bar when the calendar view is active (it remains on other screens).

---

## 3. Bulk Rates & Availability  *[CM screen: "Bulk Update" — Restrictions merged in, B3]*

### 3.1 Multi-field editor (replace the "Edit type" dropdown)
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

### 3.2 Preview & Apply → confirm-then-result modal
Preview & Apply opens a modal **summarising every update** (room types / rate plans, date range,
attributes + values) with an **Apply** button.
- User reviews → clicks Apply → **only then** are updates written.
- Success: green **"Successful"** + short summary. Failure: red **"Not successful"** + short summary of
  what failed (and why, where known).
- Dismiss via **X or backdrop** in both cases.
- `[build note]` **One shared modal pattern** (preview → apply → result, X/backdrop, green/red). **Reuse
  for the calendar bulk modal (§2.1)** so both entry points behave identically.

### 3.3 Rename "Restriction Rules" → "Your active restriction rules"
Label rename only; no behaviour change.

---

## 4. Rooms & Rates

### 4.1 Vertical restack (rooms on top, rate plans below)
Layout changes from rooms-left / rates-right to **stacked**: **rooms on top, rate plans below**, both as
**collapsible rows** with a **per-row toggle + a single expand/collapse-all**.
- Expanding a **room** shows its assigned rate plans (linkage quick-view).
- Expanding a **rate plan** reveals its settings (pricing, policies/defaults, derived linkage — §4.2).
- `[build note]` Reuse the collapse/expand-all interaction from the Calendar. **Verify current state
  first** (B4 built the Rooms & Rates + Rate Plan Linkage tab) — if it's already stacked, this is a no-op.

### 4.2 Make Rate Plan Linkage **editable** (was read-only)
The user can **edit** an existing relationship (change parent or offset) and **add** a new relationship to
existing rate plans — so a derived-rate rule can be created **both at creation time and afterwards**.
- `[build note]` — guardrails (touches the derived-rate engine):
  - **No cycles.** Reject circular links (A→B→A) and self-reference (A→A) on save, with a clear message.
  - **Recalculate on change.** Editing parent/offset recalculates the child's derived values across
    affected dates, through the **same recalc path used at creation** — no stale values.
  - **Manual parent only.** A derived rate's parent must ultimately resolve to a manual rate. If chains are
    allowed (A→B→C), enforce a **max depth** and walk the chain in order.
  - **Respect precedence.** Derived values stay subordinate to date-scoped edits under the two-tier model —
    making a rate derived doesn't override a more-recent manual date-scoped value.
  - **Existing data.** When linkage is added to a rate plan that already has values, **decide + document +
    surface to the user before saving** whether existing manual values are overwritten by the newly-derived
    values or preserved until next edit.

---

## 5. Cross-cutting consistency
- **One bulk engine** behind the calendar modal (§2.1) and the Bulk screen (§3): same fields, same
  ≥1-field validation, one audit entry per apply.
- **One modal pattern** for both bulk entry points: preview → Apply → green/red result, dismiss via
  X/backdrop.
- **Paperclip = derived** wherever rates are listed (Calendar, Rooms & Rates, Bulk) — same meaning
  everywhere.
- These same patterns are shared with the CRS refinement (`CRS-REFINEMENT-R2.md`) — **build once, reuse**.
