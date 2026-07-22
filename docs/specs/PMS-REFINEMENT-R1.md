# RevioPMS — Page-by-Page Refinement Review (Round 1)

> **Provenance.** Founder doc delivered 2026-07-20 (`Revio Development Docs (2).docx`). A *running* spec —
> the founder marked **"PENDING – CLOSE DAY SCREEN – will add later today"** at the end, so a **§11 Close
> Day section is still incoming** and must be folded in when it arrives.
>
> **Authority.** Refinement pass on top of the shipped V2 PMS (`PMS-GUIDE-V1.md`, tasks D1–F3). Every
> screen is judged by one question — *who is on this screen, and what decision/action are they here to
> make?* — with each element sorted into **earns its place / secondary / doesn't belong**. Goal per page:
> exactly the information that screen needs — insightful and functional, not overcrowded.
>
> **⚠ Staleness note.** §9 says Configuration is "locked (E7 — not built yet)," but **E7 shipped**
> (`apps/pms/app/(protected)/configuration/page.tsx` exists) — this doc was written against a **pre-E7
> snapshot**. Treat §9 as the **target spec to expand the existing Configuration page toward**, not a
> from-scratch build. Likewise several features below (Reservation view, Guests, User Management,
> deposits, split folios, charge-posting service, invoicing, room-assignment) already have a **base** from
> D/E/F — this round is **additive refinement**, not a rebuild.

---

## 1. Front Desk
**Who / what:** the receptionist doing the day's desk work — check in, check out, walk-ins — and seeing
what will bite today before it does. **Organizing principle:** *exceptions find the receptionist; routine
stays quiet.*

- **1.1 Swap the top KPI row to front-desk metrics.** Replace HK's Rooms/Clean/Dirty/Inspected/OOO with
  desk-relevant KPIs: **Arrivals today · Departures today · In-house / occupancy · Rooms ready to assign
  (clean + inspected combined) · Out of order.**
- **1.2 Body = two co-equal action columns** — **"To check in"** and **"Due out today"** side by side.
  Full **In-house roster** in a **collapsible section beneath** (not a tab). **State-aware default:**
  in-house collapsed when there's check-in/out work; auto-expands when both action lists are empty. Header
  always shows the in-house count; expanded → its own search/filter; per-row actions **folio · move · open
  reservation** (not Check out — §1.3).
- **1.3 Move "Check out" to the Due-out list only.** Remove it from general in-house rows (showing it on
  multi-night stayovers invites checking out a guest with nights remaining). In-house rows keep folio,
  move, open reservation.
- **1.4 Collapse empty states.** Empty Arrivals/Departures collapse to a slim line and hand space to
  whatever has items.
- **1.5 Room-ready status: prioritize on arrivals, de-emphasize on in-house.** The clean/inspected tag is
  decision-relevant on an arrival, near-useless on a stayover — weight accordingly.
- **1.6 Overdue checkouts (new).** Two distinct states: *"Due out today, past checkout time"* (gentle
  nudge) vs *"Overstayed — past departure date, never checked out"* (data-integrity problem distorting
  occupancy/availability). Placement (no new panel): a **red Overdue state on Due-out rows** (with how long
  past), a **count in the Departures header**, a **top-row alert when > 0**.
- **1.7 Extend checkout (new).** A per-reservation **same-day** override of the property checkout time
  (e.g. to 14:00). Suppresses overdue until the new time. **Flows to Housekeeping** (room ready-time
  shifts). **Optional charge:** offers to post the "Late Check-out" extra — **chargeable by default** (a
  property setting sets the default), the desk can **waive to complimentary** one-tap, **reason-logged**
  like the balance/deposit overrides; a waived charge stays on the folio as **waived / €0**, never omitted.
  `[build note]` **scope guard:** "Extend checkout" is strictly a same-day **time** grant with **no
  availability impact**. "Stay another night" is a **different flow** (extends the reservation, consumes
  the next night's availability, may hit a rate, can collide with an incoming booking) — route it to a
  proper **availability-checked stay extension**, never through this button.
- **1.8 Headline additions.** One idea in different clothes — *surface the exception before it's a
  problem*:
  - **a. "Needs attention" exception strip** (the headline pattern) — one quiet line near the top,
    appears only when it has content, the **only** place exceptions live: overdue checkouts, unassigned
    arrivals, rooms-not-ready blocking a check-in, balance-due on due-outs, VIP/flagged arrivals.
  - **b. Room-ready ↔ arrival link, made active** — "room not ready" flag with one-tap **"prioritize this
    room"** pushing it up the HK queue (only possible because Revio shares one core — a real
    differentiator).
  - **c. Unassigned arrivals as an alert** — a count in the arrivals header ("2 not yet assigned") + one-tap
    assign.
  - **d. Balance-due on the departures list** — a balance flag on Due-out rows (folio already knows).
  - **e. Returning-guest / VIP signal on arrivals** — a small marker from the operational guest profile.
- **1.9 Deferred:** real-time presence (infrastructure); guest messaging from the desk (separate module).
- **1.10 Dependencies & open decisions.** **Hard dependency (build first):** Configuration must own a
  **Check-out time** (+ partner **Check-in time**) setting — §1.6/§1.7 measure against it. Add a
  **late-checkout charge default** (complimentary vs chargeable) property setting. Other deps already in
  the shared core: room-ready link → HK↔arrival assignment; balance flag → folio balance; VIP/returning →
  operational guest profile (§3.3); unassigned alert → assignment state; Extend → HK ready-time shift + POS
  "Late Check-out" extra. **Resolved:** in-house roster → state-aware collapsible; late-checkout →
  chargeable by default + one-tap logged comp waiver.

> **BUILT — J1 read-side (2026-07-21).** Front Desk (`/dashboard`) refined: **§1.1** KPI row swapped to
> front-desk metrics (Arrivals · Departures · In-house · Rooms ready to assign · OOO); **§1.2/§1.3** two
> co-equal columns (To check in · Due out today) with an in-house roster in a state-aware collapsible section
> beneath (auto-open when no check-in/out work) and check-out **only** on due-out rows; **§1.6** overdue
> detection — `overstayed` (past departure, still in-house) + `past_time` (past checkout clock), measured
> against `Property.checkOutTime`, with header count; **§1.8a** the "Needs attention" exception strip (only
> place exceptions live: overstays, past-time, blocked arrivals, balance-due due-outs, conflicts, returning
> guests); **§1.8d** balance-due flags on due-outs; **§1.8e** returning-guest marker (≥1 completed prior stay,
> keyed on the J0 stable Guest id). **Deferred to a J1 follow-up** (need schema / write-wiring): **§1.7**
> extend-checkout (same-day time grant + optional waivable Late Check-out charge — needs a per-reservation
> override field + POS item + config default), **§1.8b** one-tap "prioritize this room" into the HK queue,
> **§1.8c** one-tap assign for unassigned arrivals.

## 2. Reservation view
**Who / what:** any front-office user who opened a booking — the hub Front Desk rows and Guests history
link into. **This screen is very good — mostly keep** (commercial/operational split, timeline).
- **2.1 Make it the action hub.** The Front Desk actions (§1) live here as buttons: **check out, extend
  checkout, move room, post charge, open folio.** Front Desk rows open into this view.
- **2.2 Remove dev-facing scaffolding.** "Deposit handling arrives in phase E4" → a real empty state ("No
  deposit held") or hide the Deposits block until deposits exist.

> **BUILT — J2 (2026-07-21).** Reservation view (`/reservation/[id]`): **§2.1** action hub — Open folio ·
> Check in · Move room · Post charge · Check out, each gated by stay state (booked / assigned / in-house);
> **§2.2** the "Deposit handling arrives in phase E4" scaffolding replaced with a real state (deposit held
> amount, else "No deposit held"). Extend-checkout is part of the deferred J1 follow-up.

## 3. Guests
**Who / what:** front-office staff recognising and serving a guest. The **operational** profile the CRS
deliberately isn't. Issue is **under-populated data shown at full weight**, not over-building.
- **3.1 List — good + lean; add find-ability.** Keep the columns (Guest / Stays / Nights / Ancillary spend
  / Lifetime / Last stay). Add **sort + search** (lifetime, nights, last stay; search by name). Remove the
  dev-facing caption.
- **3.2 Profile — degrade gracefully (main fix).** Show metrics that have data prominently; **collapse/
  soften empty ones** (a subtle "no ancillary spend yet," not a full-weight €0 card). A profile should look
  **earned** — richer as the guest returns — never a full dashboard stubbed with zeros on day one.
- **3.3 The n=1 preferences guard (important).** Deriving "Preferred room 404 / floor 4" from a single
  walk-in is a **false signal**. Gate derived preferences behind **≥ 2 stays**; below it show "Not enough
  history yet." A wrong preference is worse than none — it feeds the Front Desk VIP/returning logic.
- **3.4 Requests & notes — two distinct kinds.** Split **standing requests** (persist across stays — "high
  floor, feather-free") from **per-stay notes** (this stay only). (Open decision: two sections —
  recommended — vs one combined area.)
- **3.5 Stand-out additions** (make the profile an **action surface**). In priority order:
  - **Guest merge / duplicate detection + stable identity — foundational (build first).** A stable guest ID
    across reservations (direct / OTA / walk-in) + duplicate detection (same email/phone/name) + a merge
    action. Without it, "Ventsi Mukov Mukov" and a future "Ventsi Mukov" fragment and every metric rots.
  - **Action-paired profile** — pair each metric/preference with a one-tap action (offer upsell, assign
    preferred floor, resend document).
  - **Blacklist / do-not-rebook flag** — surfaces at booking + check-in, with reason + role permissioning
    (sensitive).
  - **Contact + consent capture (GDPR)** — email/phone/marketing-consent, right-to-be-forgotten, export.
    EU wedge + prerequisite for any future guest messaging.
  - **Recognition surface** — last stay's room, what they consumed, any logged complaint + resolution.
- **`[boundary — don't cross]`** This stays an **operational profile** — no segmentation, campaigns,
  loyalty programs, or email marketing. It is **not a CRM**.

> **BUILT — J3 slice (2026-07-21).** Guests refined on the J0 identity foundation: **§3.1** list gains
> search (name/email) + 3-click sortable columns + the dev caption removed (`components/guests/GuestsTable.tsx`);
> **§3.3** the n≥2 preference guard — preferred room/floor suppressed below 2 stays with "Not enough history
> yet"; **§3.5 (headline)** duplicate detection + merge on the profile — a "possible duplicates" panel
> (same email/phone/name, via `findDuplicateGuests`) with a one-click **Merge into this guest** that
> re-parents the loser's stays + notes and flags it (`mergeGuests`), verified end-to-end. **Deferred to a J3
> follow-up** (need schema): **§3.2** fuller degrade-gracefully polish, **§3.4** standing-request vs per-stay-note
> split, and **§3.5** blacklist/do-not-rebook + GDPR consent/export/erase + action-paired one-tap actions.

## 4. Folios & Billing
**Who / what:** front-office staff running the bill — post, pay, split, settle, close cleanly at checkout.
Already deep + correct (split, stay extras, deposits, void-kept-visible, "no card stored").
- **4.1 Open / History split (headline structure).** **Open** = today's operational work (in-house, live
  balances, post/pay/settle/check out). **History** = the financial record (closed/settled folios + their
  invoices, kept + searchable) — an **archive of immutable billing records**, not an editing surface.
- **4.2 History = folio-centric archive, searchable.** Primary record is the **folio** with its issued
  invoice(s) attached (users hunt for "Emma Hughes's folio," not an invoice number — but the invoice is
  reachable + searchable). Search/filter by guest name, reservation number, check-in/out date range, room,
  invoice number, status (settled/refunded/written-off), amount/balance. **Read-only** (§4.6).
- **4.3 Open list — keep lean, add find-ability.** Keep (guest, room, balance, status). Add **sort +
  search**, **sort by balance** so "who owes money" floats up.
- **4.4 Folio detail — center of gravity shifts with lifecycle.** **Open** = workspace (posting, payment,
  splits, deposits lead). **Closed** = **statement** (lead with document actions — print bill / invoice /
  credit note — + final totals; line detail beneath). Keep void-kept-visible.
- **4.5 Document layer — three distinct actions on the invoicing module** (not a screen-print): **Print
  bill** (informal, reprintable, no legal weight) · **Issue / view invoice** (the legal document — sequential
  number, issuer/buyer tax identity, taxable-supply date, VAT per rate; issued once, reissues identical) ·
  **Issue credit note** (the only correction path once closed/invoiced; itself sequentially numbered).
  `[build note]` built on the invoicing module, **never a naive PDF-of-the-screen**.
- **4.6 Corrections — one concept, two lifecycle stages.** **Void** while open; **credit note** once
  closed/invoiced. **Lock-on-settlement:** a closed folio is immutable, corrections are credit notes only,
  History is strictly read-only. (Current closed-folio screen already does this.)
- **4.7 Split management (corrects the earlier empty-state note).** The two empty "Company folio" panels
  are **not** an empty state — they're the result of clicking Split twice, and **Split has no inverse**.
  Add: **Remove split** (empty → removable freely; populated → one-click "move all lines back to guest
  folio and remove"; locked once invoiced/closed). **Nameable splits** (free-text label per split — route
  to a company, another guest, any custom bucket — not a fixed "Company folio").
- **4.8 Deposits — empty state + mandatory-deposit check-in gate.** "No deposit types configured" → links
  to Configuration. **Mandatory deposits (new rule, cross-screen):** Configuration can mark deposit types
  mandatory (e.g. security €50/night, held); if one applies, **check-in is gated** on collecting it —
  can't complete until taken or explicitly **overridden (reason-logged, permissioned)**. `[build note]`
  the deposit definition carries **amount + basis** (per night / stay / person) so the gate computes the
  figure; respects held-vs-applied; the gate lives in the **check-in flow**, the rule in **Configuration**,
  collection through the **folio deposit mechanism**.
- **4.9 Stand-out additions.**
  - **Checkout-readiness signal (headline)** — before close, the folio shows whether it's **clean to
    settle**: balance zero? deposit resolved? invoice issued if required? The money-equivalent of the Front
    Desk exception strip.
  - **Reverse charge-to-room lookup** — outlet-first: from a charge, fast guest/room lookup ("type name or
    room → confirm → post"). Ties to the charge-posting service.
  - **Audit-on-hover** — every line carries who posted / voided (why) / overrode / moved it, in line detail
    on hover/expand.
  - **Multi-currency display at payment (display only)** — show the balance in the guest's likely currency
    as an informational conversion; EUR stays the folio currency of record.
  - **Group / master-folio billing — flagged, deferred.** One master folio pays room+tax for a block,
    individual folios carry incidentals. A whole billing mode; the segment can launch without it.
- **4.10 Boundary.** The folio **records what happened**; it is **not** the accounting system or pricing
  engine. Out: comp/discount approval engines, tax-exemption rule builders, re-pricing a stay from the
  folio (rates are the CRS's job), anything resembling a general ledger (**export** to accounting, don't
  become it).

> **BUILT — J4 slice (2026-07-21).** Folios & Billing split into **Open / History** tabs (§4.1): **Open** =
> live in-house bills with search + a "Who owes" balance sort (§4.3, `components/folios/OpenFoliosTable.tsx`);
> **History** = the read-only financial archive of departed stays — folio-centric, searchable by guest /
> reservation # / invoice #, with balance + settled/closed status + attached invoice numbers
> (`listFolioHistory`, §4.2/§4.6). **Deferred to a J4 follow-up:** §4.4 closed-folio-as-statement re-weighting,
> §4.5 document-layer actions (print bill / issue invoice / credit note on the invoicing module), §4.7
> split remove + nameable splits, **§4.8 mandatory-deposit check-in gate** (needs a `DepositType.mandatory`
> flag + the check-in gate), §4.9 checkout-readiness signal + audit-on-hover.

## 5. Extras & Charges (renamed from "Minibar / POS")
**Who / what:** any staff member posting an incidental charge — reception, later outlet staff under the
charge-posting service. Built screen is good (tap-to-post + "Posted this stay" — keep).
- **5.1 Rename** "Minibar / POS" → **"Extras & Charges."**
- **5.2 Reframe: pick a folio, not a room.** Population = **open folios**, defaulting to in-house; closed
  excluded (lock-on-settlement). Add the **reverse guest/room search** at the top (§4.9). Arriving-today
  folios reachable for pre-check-in cases (§5.3).
- **5.3 Pre-check-in charge rule.** Gate by **charge type + stay state**, not a blanket block. Allowed
  pre-check-in: **deposits + pre-booked extras**. Wait for check-in: **room-consumption items (minibar)**.
- **5.4 Posted line = the control surface (add the inverse).** Keep the instant "Posted this stay" list;
  make it where corrections happen: **quantity** (inline stepper), **void** (→ credit note once closed,
  §4.6), **who-posted + optional note** (audit-on-hover + free-text like "Laundry — 3 shirts").
- **5.5 Explicit folio-routing when splits exist.** When a guest has split folios, posting must show where
  the charge lands — "Posting to: Guest folio," with the option to route to the company split (§4.7).
- **5.6 Manageable catalog (hybrid — locked).** "Manage catalog" must actually add/edit/remove. A catalog
  item carries **name + price + category + tax rate** (the tax category feeds the invoice VAT breakdown —
  an item without one is a bug). **Hybrid:** a fast "add item" here for the common case, saving into the
  **Configuration-owned catalog** with its tax category. Keep **reusable catalog item** distinct from a
  genuine **one-off ad-hoc charge** (free-text + amount, already on Post-a-charge). Add **catalog search +
  favourites**.
- **5.7 Deferred / bounded.** Stock/inventory tracking (different job — inventory, not billing). **Outlet
  awareness** — build the catalog's **category field to extend to outlets now**, so it isn't retrofitted.
- **5.8 Boundary.** Posts charges; **not** an inventory system or full POS terminal. Out: stock control,
  cash-drawer, table/tab management.

> **BUILT — J5 slice (2026-07-21).** **§5.1** "Minibar / POS" renamed **"Extras & Charges"** (sidebar +
> page titles + back-link); **§5.2** landing reframed to "pick a guest's open folio" (population is already
> the open-folio list); **§5.4** posted lines are now the control surface — each carries an inline **void**
> (while the folio is open; → credit note once closed, §4.6) that keeps the struck-through line visible.
> **Deferred to a J5 follow-up:** §5.3 pre-check-in charge-type gate, §5.4 inline quantity stepper +
> per-line note, §5.5 explicit split-folio routing on post, §5.6 catalog search/favourites + reverse
> guest/room lookup.

## 6. Housekeeping
**Who / what:** two different people — a **housekeeper** ("what next, mark done" — a focused, sequential,
mobile worklist) and a **supervisor/reception** ("state of the whole floor" — the board). The build has the
two hardest ideas right (Smart order / By floor toggle; one-room-in-progress rule) but reads as a status
grid, not a work tool.
- **6.1 Role-scoped views (headline).** The view follows from **who you are** (role), not a button anyone
  flips. Top-of-screen switcher offers **only the views the role is entitled to** (roles from §10:
  Housekeeper, HK Supervisor, Reception, Manager, Owner). **Housekeeper view** — assigned rooms in priority
  order, as a list, current room expanded with **one advance-action** (Start → Done), rest collapsed;
  mobile-first. **Supervisor view** — the full board (all rooms, inspection approvals, reassignment,
  room→cleaner map; Smart order / By floor lives inside this view). **Front Desk view** — a stripped-down
  **readiness** view (which rooms are ready now, are arrivals' rooms ready). `[build note]` two levels:
  **role view** (permission-scoped) and, within it, **arrangement** (Smart order / By floor) — don't
  collapse into one button row.
- **6.2 Interface: list vs grid by role.** Housekeeper → **list**; supervisor/board → **grid**. **Kill the
  status dropdown for housekeepers** — one button that advances the room to its **legal next state** only
  (a maid can't inspect their own work).
- **6.3 Lifecycle reads as a sequence ending in "Ready."** States are a pipeline, human-labelled: **Dirty
  → In progress → Awaiting inspection → Ready.** (Rename "Cleaning" → "In progress"; end state "Ready" =
  "can I assign/sell this room?".) Inspection toggle changes what "done" means: **ON** → finishing sets
  "Awaiting inspection" (amber), only supervisor approval → "Ready" (green); **OFF** → finishing sets
  straight to "Ready," "Awaiting inspection" never appears. `[build note]` **build the "awaiting
  inspection" state in the machine always**; the per-property toggle just gates auto-advance (so it can be
  turned on later without rework). Sampled inspection = a later third mode (§6.10).
- **6.4 Suggestion logic — show its reasoning, drop OOO.** Priority: **same-day arrival (soonest ETA) →
  VIP/known-preference arrival → room-move target → stayover service → departure-with-no-arrival
  (lowest).** **Show the reason on each room** ("Arrival 2pm," "VIP arriving," "Move-in 4pm," "Stayover") —
  the reason is what makes staff trust the order. **OOO rooms drop out of the cleaning queue.**
- **6.5 Summary tabs — lead with the risk number.** Make status counts **explicit filter chips**. **Lead
  with the one decision number: "arrivals still without a ready room."**
- **6.6 Per-cleaner assignment (build now).** Supervisor assigns rooms to specific cleaners; a cleaner's
  worklist = their assigned rooms in priority order. Supervisor + manager always see the **room→cleaner
  map**. **Auto-distribute** the queue across active cleaners (balance by count and/or estimated time,
  respecting priority), with manual override.
- **6.7 Clock-in / active workforce (new).** Cleaners set themselves **active** in the morning (clock-in)
  from their Housekeeper view; only active cleaners receive assignments. Active count feeds assignment +
  **feasibility** (rooms-to-clean + arrivals-needing-ready-rooms vs active cleaners). Clock-in time is a
  manager KPI. `[build note]` light **workforce-availability + KPI** signal, **not** payroll/attendance/HR.
- **6.8 Event stream + manager-only analytics (the differentiator).** Every status change (+ clock-in) is
  an **event** (who · room · from→to · timestamp) powering the real-time board **and** a manager-only
  **"Housekeeping performance"** view: rooms cleaned per cleaner, avg clean time, which rooms/types take
  longest, throughput, inspection pass/fail rate. **Measure quality + speed, not speed alone.**
  `[build note]` two guardrails: **paused/abandoned cleans skew averages** (handle with a max reasonable
  duration or explicit pause); this is **employee data** — manager-only, EU worker-monitoring/GDPR aware,
  **no live leaderboard to staff**.
- **6.9 Boundary.** Clock-in + stats = availability, fair workload, light KPIs — **not** timekeeping/
  payroll/HR. Out: shift scheduling, pay calc, break/labour-law, HR attendance.
- **6.10 Deferred:** sampled inspection (inspect X%).

## 7. Rooms
**Who / what:** a manager setting the property up + occasionally maintaining it — a **configuration/setup**
screen, not daily-ops. Already well-built (attributes, connecting links, per-room lifecycle timeline,
generate-rooms). This is refinement.
- **7.1 Beds & max occupancy (missing — build with structured bed config).** Structured bed config (counts
  of king/queen/twin/single/sofa-bed), not free-text — it feeds assignment preference-matching. **Where it
  lives:** **Max occupancy** is largely a **room-type** property (commercial capacity the CRS sells) — on
  the shared room-type record (CRS/RevioLink), type default + per-room override. **Physical bed config** is
  **per physical room** and lives in **PMS Rooms** (101 king, 102 twin within one type enables matching);
  defaults from the type, commonly set per room. **Reconcile, don't contradict** CRS commercial capacity
  (shared core, one record).
- **7.2 View work — collapse, arrange, search.** Collapse/expand per **room type** with expand/collapse-all
  (see six type headers, drill into one). Collapsed header **summarizes** ("12 rooms · 10 clean · 1 dirty ·
  1 inspected · cap 2"). **By type / By floor** toggle (mirrors Housekeeping). **Search/filter** by type,
  floor, status, feature.
- **7.3 Floor / zone as a first-class object (new).** Promote floor/zone from a text label to a
  configurable object carrying **characteristics** (adult-only, accessible, quiet, smoking, VIP/executive,
  staff-only/not-for-sale). Rooms **inherit** floor attributes, per-room override. Feeds assignment as
  **warn-and-steer, not a hard block**. `[build note]` **legally sensitive, build soft** — age-based +
  accessibility rules vary by jurisdiction and cut both ways; build **warn-and-override**, not hard legal
  enforcement; the property owns the legal call. **Boundary:** a handful of useful flags — yes; a general
  conditional-placement rules engine — no.
- **7.4 Lifecycle timeline — make it self-populate.** Feed the per-room history from the **Housekeeping
  event stream** (§6.8) — every status change, maintenance task, move lands here. who + timestamp on each.
- **7.5 Bulk edit (build now).** Bulk actions across a range/selection — set a feature, floor, or bed
  default across many rooms. Pairs with the generate tool.
- **7.6 Two correctness fixes.** **Delete guard** — a room that's occupied, assigned, or has future
  reservations must not be one trash-click away. **Connecting-rooms picker tidy** — default/filter to
  same-floor + make it searchable.

## 8. Maintenance
**Who / what:** a maintenance **crew** (mobile — my tasks, in order) + a **manager** (board + analytics).
Same shape as Housekeeping — **reuse the pattern** with maintenance's own priority logic, lifecycle, and
the OOO-revenue twist. Built screen is a good manager-board start.
- **8.1 Reuse from Housekeeping.** Prioritized queue (§6.4 pattern, own signals §8.2); **crew mobile view**
  (assigned tasks in order, one advance-action, no status dropdown); **clock-in / active-workforce KPI**
  (§6.7 — one shared mechanism); **event-stream analytics** (§6.8, manager-only). **No supervisor/inspection
  gate** — simpler role model: **Crew + Manager** (+ a light front-desk read).
- **8.2 Maintenance's own priority logic** (near-inverse of housekeeping — severity-and-revenue-led):
  **Safety/urgent → Revenue-blocking (OOO) → Occupied-room issue → Arrival-blocking → Everything else.**
  Show the reason on each task ("Safety," "OOO — revenue loss," "Guest in room," "Arrival 3pm").
- **8.3 Maintenance lifecycle (its own, incl. On hold).** **Reported → Assigned → In progress → On hold
  (awaiting parts) → Done**, plus a **needs-contractor** branch. "On hold — awaiting parts" is decided-in.
  No inspection step.
- **8.4 The OOO ↔ revenue loop (headline).** Creating an OOO-flagged task takes the room off sale (already
  built → CRS/channels via the waterfall). **Completing the task prompts to put the room back in service /
  on sale** — close the loop so revenue doesn't leak. **Headline number: "rooms out of order — N nights of
  lost availability."**
- **8.5 Cost / parts — bounded.** Light cost capture per task ("replaced tap — €40"), feeds owner
  analytics. **Boundary:** a cost note + optional part, **not** inventory/procurement/PO/asset-management.
- **8.6 Photos + task-creation entry points (mostly built).** Photos on **report and fix** (add the **fix
  photo** — proof of completion; feeds damage-deposit evidence). Multiple entry points into one queue: HK
  "report an issue" (wired), reception/guest complaint, manager direct, preventive (§8.8). Room-history
  link already wired.
- **8.7 Manager analytics** (manager-only, same event stream): tasks/technician, avg time-to-resolve by
  priority, **which rooms generate the most maintenance** (capex signal), repair spend by room/type. Same
  EU worker-data caution.
- **8.8 Deferred:** preventive / recurring maintenance (build the reactive engine first).

## 9. Configuration
**Who / what:** the owner/manager setting up the property. ⚠ **doc says "locked (E7 — not built yet)" but
E7 shipped** — treat this as the **expansion target** for the existing page. Configuration is the home for
everything the operational screens **read but don't own**. Risk = one giant form; fix = **grouped sections
+ search + deep-links** (§9.10). **Guiding boundary:** it **reads shared config** (identity, core tax)
rather than duplicating — one source of truth across RevioLink/CRS/PMS.
- **9.1 Property profile & identity** — name, address, currency (EUR), timezone/property-time; **legal/tax
  identity** (issuer legal name + VAT ID, required by invoicing §4.5). Shared with CRS where it exists —
  **read it, don't re-enter**.
- **9.2 Times & front-desk defaults** — **Check-in + check-out time** (§1.10); **late-checkout charge
  default** (chargeable vs complimentary, §1.7).
- **9.3 Taxes, VAT & city tax** — VAT rate per charge category (accommodation reduced, F&B, other);
  city-tax mode (payable-on-spot vs included) — **defined in CRS, applied by PMS**; core tax setup shared.
- **9.4 Invoicing & compliance (the third integration boundary)** — invoice number series (gapless,
  separate for invoices/proformas/credit notes); **jurisdiction / compliance pack** (drives tax rates,
  labels/language, rounding, whether fiscalization and/or structured e-invoicing are active — **Bulgaria =
  launch blocker**: N-18 fiscalization live before a BG property goes live; EU e-invoicing EN 16931 design-
  for-now; SAF-T in mind); **payment gateway connection** (tokenised — Stripe/Adyen/regional; store token +
  result, never a card number). See `BG-FISCALIZATION-RESEARCH.md`.
- **9.5 Deposits** — deposit types (Consumption, Damage, property-defined) each carrying **held vs applied**,
  **amount + basis** (per night/stay/person), **VAT-at-capture-or-use**, and a **mandatory flag** (enforces
  the §4.8 check-in gate).
- **9.6 Outlets & the Extras catalog** — outlets (Minibar, Spa, Bar, Restaurant) + their catalogs; items
  carry name + price + category + **tax rate** (§5.6); the fast "add item" saves here with its tax category.
- **9.7 Housekeeping & assignment settings** — **inspection mode** per property (mandatory / off; later
  sampled X%); estimated clean time per room type (optional); **auto room-assignment opt-in** per property
  (off by default) + the "suggest a room without committing" middle ground.
- **9.8 Roles & permissions** — role definitions (Owner/Admin, Manager, Reception, Housekeeper, HK
  Supervisor, Maintenance, Outlet/POS) + the permission matrix driving §6.1 role-scoped views; includes the
  **clock-in delegation** permission (§10.3). Roles defined here; users assigned in §10; both act on the
  **one shared identity**.
- **9.9 Not owned here** — room/floor setup stays in Rooms (§7); room types, rate plans, commercial
  occupancy stay on the shared room-type record (CRS/RevioLink); not an accounting system / HR / rules
  engine.
- **9.10 Interface** — **grouped sections** (Property · Times · Tax · Invoicing & Compliance · Deposits ·
  Outlets · Housekeeping · Roles), **searchable**; **deep-links** from where a setting bites (folio "no
  deposit types" → here, HK inspection toggle, Extras fast-add).

## 10. Staff & Access Management (renamed from "User Management")
**Who / what:** manager/owner (+ delegated FD/supervisors for clock-in). Two jobs fused: **Staff** (who's
working today — live cross-department roster + clock-in) + **Access** (who can log in and do what). Today
the screen is only user CRUD; this expands it. **Two boundaries:** **one shared identity** (all CRUD acts
on the single cross-product account); **not payroll/HR** (clock-in = availability + light KPI + access).
- **10.1 Rename** "User Management" → **"Staff & Access Management."** **Already built (keep):** shared-
  identity model correctly implemented (invite / role-assign / deactivate work). §10 is **additive**.
- **10.2 Workforce dashboard (live, top of screen).** Summary tabs of **who's available right now**, grouped
  by role/department, for the current day/shift — live statuses, not history (Housekeepers active + names;
  Maintenance active; Reception; Management…). **Clock-in as a KPI for every PMS-role user.** Shift-aware if
  the property runs shifts. The central cross-department roster (operational screens show their own
  department; this is the roster).
- **10.3 Clock-in mechanics + delegated clock-in.** Staff set themselves active (clock-in) from their own
  view; clock-out ends the shift. **Delegated clock-in:** FD + Supervisors can clock **their department's**
  staff in/out (not everyone self-clocks). Managers toggle this per role via the matrix (§9.8). `[build
  note]` clock-in-by-proxy is **logged** (who clocked whom in); same event stream feeds the KPI + operational
  availability — one mechanism.
- **10.4 User management (CRUD — on the shared identity).** Add, assign role(s), edit, deactivate, delete,
  reset password, change email/phone — all on the one shared identity. Roles from the §9.8 matrix. Prefer
  **deactivate over hard-delete**; searchable list.
- **10.5 User detail — access & security (click a user).** **Action history** (audit of what they did),
  **login history**, **devices & IPs**, **restrict device**, **temporary access restriction** (suspend for
  a period without full deactivation).
- **10.6 Boundaries & cautions.** Shared identity (all CRUD → one account). Not payroll/HR/timesheets.
  **Employee personal data** — action/login/device/IP history + clock-in KPIs are worker-monitoring data:
  manager/owner-only, legitimate purpose (security + audit), EU/GDPR handling. **Open decision:** is
  login/device history product-scoped (PMS) or global (identity everywhere)? Global is more complete — flag.

## 11. Close Day — **PENDING** (founder to add)
The founder marked "PENDING – CLOSE DAY SCREEN – will add later today." Fold in when it arrives. Current
PMS Close Day (E8) is the base.

---

## Build status — Phase J (RevioPMS R1)

> **J0 foundations BUILT (2026-07-21).** The three "build-first" data foundations the screens depend on:
> - **Guest identity + merge (§3.5):** `Guest.mergedIntoId` soft-merge self-relation. `guest-identity.ts`
>   (`findDuplicateGuests` — same email/phone/normalized-name candidates, strongest-signal ranked) +
>   `actions-guests.ts` (`mergeGuests` — re-parents reservations + notes to the winner, back-fills missing
>   contact fields, flags the loser, audit-logged, manager-gated). Nothing is deleted; ids stay resolvable.
> - **Ops event stream (§6.8/§7.4/§8.7):** new `OpsEvent` model (domain · action · unit · user · actor ·
>   from→to · at) + `events.ts` (`recordOpsEvent`, `getUnitTimeline`, `getHousekeepingPerformance` with the
>   paused-clean outlier guard). Manager-only analytics; never a live leaderboard.
> - **Clock-in / workforce (§6.7/§10.2-10.3):** new `StaffShift` model (active = clockOutAt null,
>   `clockedInById` for delegated) + `workforce.ts` (`getActiveShifts`, `getWorkforceSummary`,
>   `getActiveCleanerCount`) + `actions-workforce.ts` (self + delegated clock-in/out, each appending an
>   OpsEvent). Availability + light KPI only, not payroll/HR.
>
> Migration `20260721182000_pms_r1_foundations` (additive: new tables + RLS + nullable column). The **§9
> Configuration expansion** (grouped/searchable sections + deep-links on the shipped E7 page) and the ten
> screens (J1–J9, J11; J10 Close Day awaits §11) build on top of these primitives.

## Cross-cutting principles (running)
- **Derived signals need a minimum sample (n ≥ 2)** — a "preference"/"usual"/"returning-guest" signal must
  not be inferred from a single occurrence; below threshold show "not enough history yet." Governs Guest
  preferences (§3.3) + Front Desk VIP marker (§1.8e).
- **Identity resolution is foundational** — stable guest ID across direct/OTA/walk-in + duplicate detection
  + merge (§3.5) underwrites every guest metric. Build early.
- **Degrade empty states gracefully** — screens look **earned**, never stubbed with zeros. (Distinguish a
  genuine empty state from a user-created one — the empty split folios in §4.7 are a missing *remove* action.)
- **No dev-facing scaffolding in shipped UI** — "arrives in phase E4," internal captions → real empty states
  or hidden.
- **A screen's center of gravity shifts with lifecycle state** — open folio = workspace, closed = statement;
  re-weight by state, don't show a locked version of the active layout (§4.4).
- **Readiness signals before irreversible actions** — "is this clean to proceed?" before the costly step.
  Front Desk exception strip (§1.8a) = folio checkout-readiness (§4.9.1) = same pattern.
- **Every add/create action needs a matching inverse, gated by lifecycle** — free while open, credit-note /
  locked once settled. Split folios (§4.7), posted charges (§5.4), void-vs-credit-note (§4.6).
- **Role shapes the view, not just permissions** — each role gets its own default view + shape, gated so
  switching can't escalate permissions. Housekeeping (§6.1) is the clearest case.
- **Set defaults at the general level, override at the specific** — room-type → room (occupancy, beds),
  floor/zone → room (characteristics), property → room (inspection mode). Echoes the CRS precedence-by-
  specificity model.
- **Settings are reachable from where they bite** — deep-link to Configuration from the screen that needs
  it, don't make the user hunt (§9.10).
