# RevioPMS — Live-Product Refinement (Round 2)

A refinement pass on the **live** PMS (real data, real edge cases). The bar: not "is this well-designed" but **"does this hold up in production."**

Priority: **(1) the checkout / folio / overstay state-machine bug (blocker)**, (2) the move-reservation rebuild, (3) the interactive rooms×dates calendar.

---

## 1. Checkout / folio / overstay — state-machine fix (BLOCKER)

### 1.1 The bug, as observed
A reservation (Ventsi Mukov, room 407, €513) was checked out with an override balance, producing a self-contradicting, deadlocked record:
- Folio header reads **"closed · Closed"**, footer says **"This folio is closed. Final balance €513"** — yet shows a **€513 balance in red**, a banner **"Settle the balance first, or check out with an override,"** and appears in the **Open** folios list. The record believes it is *closed and open, settled and owing* at once.
- The reservation shows **"Overstayed 41 nights"** though it was checked out.
- Impossible charges: room dates 2026-07-06→09, but **Breakfast extras dated 07-17 → 07-22** — recurring stay-extras posted *nine days after checkout*, on a "closed" folio.
- It is **deadlocked**: can't check out (already checked out), can't take payment or close (folio already closed).
- Not isolated — Hugh Reyes "Overstayed 20 nights · €484", etc.

### 1.2 Root cause
1. **Checkout-with-override is a partial commit.** It marks the **folio** closed but does **not** transition the **reservation** to departed or stop the accrual clock. The night audit keeps re-flagging overstay and posting stay-extras.
2. **Queries read derived proxies, not status.** "Open folios" keys off *balance ≠ 0*; "Overstayed" keys off *past-departure + still-occupied* without checking *checked-out*.

### 1.3 The fix — three parts

**A. Checkout is one atomic transaction.** Override-checkout must, in a single commit: reservation → **Departed**; **stop the accrual clock**; room → vacated + dirty; folio → **closed** carrying its balance as a **defined outcome** (§1.4). No path may close the folio while leaving the reservation in-house.

**B. Queries read status, not proxies.**
- **"Open folios" = folios whose status is `open`.** A closed folio with a balance belongs in the receivables view (§1.5).
- **"Overstayed" = past departure date AND not checked out.** A departed reservation can never overstay.

**C. Recovery path.** A manager can **reopen a closed folio (logged)** and **force-resolve** a reservation whose states have diverged. **Governing principle (product-wide): no record may exist in a state with no available action.**

### 1.4 "Closed with a balance" is a managed state — not limbo
A folio closed with a balance is **`Closed — outstanding`**: a real, tracked state carrying the debt forward (a **receivable by default**). Four manager resolutions:

1. **Reopen & take payment** — folio reopens, payment recorded, closes at zero.
2. **Mark as paid (settled off-system)** — manager records **method + reference**, folio closes as **settled**. The common real-world case.
3. **Keep as receivable** — tracked outstanding debt to chase later. Stays in the receivables view.
4. **Write off** — balance forgiven; closes at zero, logged as a **write-off / loss**, reason recorded.

**Permission model:** **visible to all roles but clickable only by a manager.** Non-managers see the balance *and* the resolutions (greyed, "manager approval required") — **visibility without authority**. Do **not** hide them from reception. Every action **logged with who + when + reason**.

**Accounting nuance (must not be conflated):**
- **Mark as paid** = revenue **collected** off-system → payment received.
- **Write off** = revenue **lost** → a deduction/loss.
Both close at zero by **different mechanisms** and must be **reported separately**.

### 1.5 Dependency — a receivables / outstanding-balances view
A place the manager sees **all folios `Closed — outstanding`** across the property, so debt is managed as a set. Home for **aged debt**; ties into folio **History** and **Close Day** readiness. Build as a light dedicated view (a "Receivables" tab alongside Open / History).

### 1.6 Also visible in these screens (fold in)
- **Empty split folios can't be removed** — two empty "Company folio" splits on Ventsi's folio, unremovable. Empty split → removable freely; populated → "move lines back & remove"; locked once invoiced/closed.

### 1.7 Note on the good parts (keep)
The **Front Desk exception strip is working as designed** and correctly surfaced this bug rather than hiding it. The folio's "closed — final balance" and the override banner are right in intent; they just weren't backed by an atomic transaction.

---

## 2. Reservations Calendar (new screen) + move-reservation rebuild

**Placement:** a new nav item in **Front Office, between Front Desk and Guests.** The move-reservation rebuild is **folded in here** — a move *is* a drag on this calendar.

**Governing rule:** every state change runs on the same **atomic, no-invalid-state discipline as §1.**

### 2.1 The tape chart
A **physical-rooms × dates grid**: rooms down the left (grouped/collapsible by type and floor), dates across the top with **weekend shading and a today marker**. Each reservation is a **horizontal bar**.
- **Colour = reservation status**, with a legend: Confirmed / In-house / Arrivals today / Due-out today / Overstayed / Complimentary / Blocked-OOO.
- **Per-day summary row**: **% occupancy** and **available rooms** per day. *No "unassigned" row — there is no unassigned state (§2.3).*
- **No rates shown.** Rates live in the CRS. The PMS reads CRS rates in exactly one place: the price difference on a cross-type move (§2.5).

### 2.2 Horizon & navigation
**Default 30-day window**, horizontal scroll, **start/end-date filters**. Legibility beats span.

### 2.3 Auto-assignment lifecycle (no unassigned state)
**Every reservation is auto-assigned a physical room on receipt.**
1. **On receipt** — auto-assigned by the housekeeping-aware logic (§2.4).
2. **Weeks/days out** — **provisional**; may be re-optimised.
3. **0–12h before arrival — the decisive optimisation pass.** The last pre-arrival moment where the system has its most accurate picture of the house. **[build note]** implement as "assign on the most accurate operational state," not just a timer.
4. **Any manual move pins that reservation permanently.** **Auto-assignments are fluid until arrival; manual assignments are frozen forever.**
5. **The calendar visually distinguishes auto from pinned.**

Guardrails: auto-assignment is **opt-in per property**; assigns from candidates **of the booked room type** (upgrades are a human decision).

### 2.4 Housekeeping-aware assignment logic
Hard filter: booked room type, free every night, not OOO/blocked. Then rank:
1. **Guest preference** (returning guests only, **n ≥ 2 rule**).
2. **Housekeeping-workload optimisation** — ready-now over needs-cleaning; whole-stay in one room; cluster same-day turnovers on a floor/zone; concentrate occupancy leaving whole zones untouched; level load across the clock-in roster.
3. **Keep contiguous availability open** (tie-break).

### 2.5 Drag-to-move (the move-reservation rebuild)
**Click any bar → the management popup (§2.6). Drag a bar → move it.** v1 scope: **click-to-open + drag-to-move only.** (Drag-edge-to-extend is a deliberate fast-follow.)

**Within the same room type**: a **pure operational move, no price implication.** Safety checks only — target free, atomic commit, logged.

**Across room types**: a **rate-affecting change → reconciliation prompt.**
1. **Safety check (atomic)**: target free for the affected nights, or reject the drop.
2. **Rate plan**: the reservation **always keeps its originally-booked rate plan.** If the new type doesn't carry it, **prompt**.
3. **Price reconciliation** — compute the difference from CRS rates and have the manager classify it:
   - **Upgrade:** **complimentary** (waive, logged as comp), **chargeable** (post the difference), or **edit**.
   - **Downgrade:** **refund**, **waive**, or **edit**.
   - Difference shown, manager classifies, **editable or removable entirely**, **logged with who + reason**.
   - **Per-night:** an arrival-day move re-rates the whole stay; a **mid-stay** move re-rates only the remaining nights and interacts with **folio-split-by-night**.
4. **Commit (atomic)**: old room released, new room occupied, folio adjusted.
5. **Record, don't distribute (§2.7).**
6. **Timeline:** logged with who + reason.

**OBP note:** the step-3 difference is read at the reservation's **occupancy**, and a same-type **occupancy change** reuses this exact reconciliation flow.

### 2.6 Click-to-manage popup (stay in the calendar)
Clicking any reservation — **including in-house** — opens the **unified reservation view as a modal over the calendar.** The user **stays on the calendar**. Inside: commercial detail (read-only, from CRS) + operational state + timeline, **plus the folio's post-charge / take-payment / actions, check-in/out, extend checkout**.

### 2.7 The CRS boundary — on-spot moves are PMS-only (critical)
- **The reservation's room type in the CRS does NOT change.** The reservation carries two facts: **booked room type (CRS, unchanged)** vs **accommodated room type (PMS, actual)**, logged as plain content: *"Original room type booked: Standard Double. Accommodated in: Deluxe Double, room 305."* **Room numbers included.**
- **No push to CRS or channel manager.** A front-desk upgrade is **not a distribution event.**
- **[build note]** the PMS **updates the physical room's occupancy** (which the availability waterfall reads) but does **NOT** rewrite the commercial room type and does **NOT** emit any reservation/ARI update. Do not (a) wrongly push a CRS/channel update, nor (b) wrongly fail to show the Deluxe as occupied.

**OBP note:** an operational upgrade never changes the occupancy-based price.

---

## 3. Close Day — no-pile-up escalation (auto-close)

**The problem:** unclosed days **accumulate** — miss 7 and the 8th requires closing 7 times. A **two-stage escalation**: nudge, then auto-close.

### 3.1 Stage 1 — reminder
Not closed by the **close deadline** (default **00:30 next day**) → a **"Close Day is due"** reminder in the **manager and all front-desk views**. **Dismissable, but only for the reminder window** (default **22 hours**).

### 3.2 Stage 2 — automatic close
Still not closed after the window (≈22:30 next day) → the system **closes it automatically.** **At most one day is ever open past its deadline, and it self-resolves.**

### 3.3 An auto-close is a real financial close (critical)
- Posts the night's room + tax + recurring stay-extras; marks no-shows; rolls the business date; produces the **locked daily record**. *(Under OBP the room charge is the snapshot occupancy rate — §4.8.)*
- **Uses the same §1-fixed close logic** — no separate lighter path.
- **Marked as system-closed:** *"Closed automatically by system on [date]"* with **no human actor**. A run of auto-closed days is itself a signal that no one is minding the desk.

### 3.4 Timings are property-configurable
**Close deadline** (default 00:30 next day) and **reminder window** (default 22h) in Configuration.

### 3.5 Edge cases
- **Readiness items don't block an auto-close.** It **closes anyway** but **carries unresolved items forward** and **notes them on the record** ("closed automatically with 2 unsettled balances").
- **No-shows and overstays resolve via the corrected logic.**

---

## 4. Occupancy-Based Pricing (OBP) — PMS implementation

*One-line framing: **the PMS captures occupancy, bills the rate the guest was quoted, and re-prices only on a real change — all on the existing state machine.***

### 4.1 What the PMS owns vs reads
- **Read-only, shared:** pricing model, per-occupancy rates, room-type `max/default_occupancy`, age policy. The PMS has **no rate table of its own.**
- **PMS-owned:** the **occupancy** on the reservation, and the **rate snapshot** it carries (§4.3). Two bounded CRS reads, both *rate-affecting reconciliations*: a **cross-type move (§2.5)** and an **occupancy change (§4.4)**.

### 4.2 Occupancy is a first-class field on the reservation
Every reservation carries **adults** (and children/infants — the separate axis). The **"doesn't fit"** guard applies.

### 4.3 Bill the quoted rate — the snapshot
The reservation keeps its booked plan **at the booked occupancy** — the nightly rates quoted at booking are **snapshotted**, and that snapshot is what the folio bills and the night audit posts — **not** a fresh CRS lookup. A guest **confirmed at the 2-adult rate is billed the 2-adult rate**. **The CRS quotes live, the PMS bills what was quoted.**

### 4.4 An occupancy change is the §2.5 reconciliation flow
1. Read the **CRS occupancy rate** for the new adult count on the affected nights.
2. Show the **difference**; the manager **classifies** — chargeable / complimentary / edit on an increase; refund / waive / edit on a decrease — **logged with who + reason.**
3. **Per-night:** mid-stay re-rates only the remaining nights and interacts with folio-split-by-night.
4. **Atomic (§1):** occupancy change and folio recalculation **commit together or not at all.**

### 4.5 The calendar shows occupancy, never rates
The **"no rates shown"** rule stands. OBP adds at most an **occupancy indicator on the bar** (e.g. `2p`). **No rate strip on the PMS calendar** — a deliberate divergence from the CRS calendar.

### 4.6 Cross-type move × occupancy
- The new type may have a different **`max_occupancy`** — validate the occupancy fits; reject or prompt.
- **Booked-vs-accommodated:** occupancy pricing rides the **booked commercial record**. Walking a 2-adult Standard into a Deluxe does **not** change the occupancy price.

### 4.7 Check-in confirms occupancy
Confirm the **actual** adult count. If it differs → run §4.4 (atomic). Capture **children/infants** here, posted as **separate folio lines**.

### 4.8 Night audit & Close Day
The nightly room charge posts the **snapshot occupancy rate** for that date. **Auto-close** inherits occupancy-correct posting with **no separate path.** **Per-room properties** behave exactly as today.

---

## Build priority
1. **§1 first — a live blocker.** Ship before the calendar, and arguably before onboarding any real property.
2. **§2 after §1.** Drag-to-move must sit on §1's atomic discipline.
3. **§3 alongside/after §1.**
4. **§4 (OBP) after §1 and §2.5.** Adult occupancy first; children/infant fees fast-follow.

## Product-wide principle established this round
**No record may exist in a state with no available action** — and: **no required daily process may accumulate a backlog.** The §1 deadlock and the §3 pile-up are the same failure in different clothes.
