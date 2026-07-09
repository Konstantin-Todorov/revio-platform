# RevioLink — Interface & Navigation Guide (v2)

> Founder spec, received 2026-07-09. Source: "RevioLink Latest 2 - Optimisations.docx".

A working spec for improving the RevioLink interface. Written to be read top to bottom by a developer who is new to hotel distribution, so domain terms are explained inline. A short glossary sits at the end — read it first if any term is unfamiliar.

The guide is deliberately conservative: RevioLink is already a competent product, so most of this is refinement. Each screen section is split into Keep (things that are correct and must survive any refactor) and Change (specific edits). Treat "Keep" as binding — several of those items are domain-correct in ways that are easy to accidentally flatten.

## 1. Orientation — what RevioLink is, and the rules it lives by

### What RevioLink is (and isn't)

RevioLink is the connectivity layer between Revio's shared core and the OTAs (online travel agencies like Booking.com, Expedia, Agoda). It does three jobs:

- Takes availability, rates, and restrictions from the core and pushes them out to the channels (via Channex).

- Receives bookings back from the channels and writes them into the core.

- Gives the hotelier a screen to configure, map, and monitor all of the above.

RevioLink is not the operational system (that's the PMS) and not the commercial brain (that's the CRS). It talks to the shared core through an API, never by reading the core's database directly. This matters because RevioLink must stay swappable — keep its boundary clean.

RevioLink also does not connect to OTAs itself. It sits on top of Channex, which holds the actual OTA connections. So RevioLink's real value is the mapping, the monitoring, and the tight integration with the Revio core — not the raw connectivity.

### The boundary rule — what may enter RevioLink at all

This is now a core principle, because violations of it are visible in the product today (see §3.8).

RevioLink deals exclusively in channel-facing data: availability, rates, restrictions, and reservations. Nothing else from the hotel's operations may enter it.

Hotel-operations events — maintenance issues, POS charges, walk-ins, housekeeping, out-of-order notes — belong to the PMS. Some of those events legitimately cause a distribution change: a walk-in consumes a room, an out-of-order unit reduces availability. In those cases the PMS updates the core, and the core emits a clean availability-changed event. RevioLink reacts to the availability change and pushes it to channels. It never receives, stores, or displays the operational reason behind the change.

The test for any event, log entry, or screen element: did this cross the channel boundary — sent to an OTA or received from one? If not, it does not belong anywhere in RevioLink.

For the developer this has two practical layers:

- Fix at the source. The PMS/CRS must not forward operational event payloads to RevioLink. Only ARI changes and reservation events cross into RevioLink. If RevioLink currently receives text like "bad smell in room 204" or "POS charge posted," the upstream event contract is leaking and must be corrected there.

- Guard at the display. RevioLink screens render only channel-push and channel-pull entry types, dropping anything else. This is a safety net, not the fix.

### The one domain model that runs through everything: two streams

Hotel distribution has two separate data streams, and RevioLink already models them correctly. Keep them separate everywhere:

- Room types carry inventory and open/close (how many rooms are for sale, and whether the room is sellable at all).

- Rate plans carry prices and restrictions (the nightly price, minimum stay, and so on).

A rate plan always belongs to a room type — it is never free-floating. When you build or change any screen, ask "is this the inventory stream or the rate stream?" and keep them visually and structurally distinct. The Mapping screen is the best existing example of this done right.

One more distinction that now drives several features in this guide: rate plans are either manual (independently priced — e.g. Standard Rate) or derived (defined as an offset from a parent, e.g. Non Refundable = Standard −20%). A derived rate's price is never edited directly; you edit the parent and the offset cascades. The Rooms & Rates screen already models this correctly with the manual/derived badge.

### Three modes of screen (this is what drives the navigation)

Every screen falls into one of these modes, based on how often someone touches it and why:

- Daily work — adjusting what's for sale and watching bookings arrive. Touched constantly.

- Configuration — connecting channels and mapping products. Touched occasionally.

- Monitoring — is everything syncing, what's broken. Touched daily but in a different, "scan for problems" mindset.

- Admin — users and settings. Touched rarely.

The current navigation mixes these modes. Section 2 fixes that.

### Channex realities the interface must respect

The plumbing is specified separately, but four backend behaviours have direct interface consequences. The UI can only be correct if these exist:

- Outbound updates are event-driven through a queue. When a rate or availability changes in the core, an event flows into a queue and is batched out to Channex. This is why the interface can show a "pending" count — it's the depth of that queue.

- Every outbound push must record which channel(s) it went to. Several health indicators are blank today purely because pushes aren't attributed to channels. See §5.1.

- Inbound bookings are acknowledged back to Channex. A booking that arrives but isn't acknowledged is a risk. The interface should be able to show acknowledgement state. See §5.4.

- Channels have different capabilities. Not every OTA supports every restriction (for example, Expedia does not support close-to-departure). This is not a failure — it's a limitation that should be known in advance, not discovered as an error. See §5.2.

## 2. Navigation — regrouping

The current sidebar has three problems: two of the most-used daily screens (Calendar, Bulk) float ungrouped at the top; Reservations sits under Distribution although it's operational, not configuration; and User Management + Settings sit under Operations although they're rarely-touched admin.

Regroup as follows. The group labels map cleanly onto the existing role model (Revenue Manager → rates; Distribution Manager → channels/ARI).

Before

Dashboard

Calendar

Bulk & Restrictions

— DISTRIBUTION —

Rooms & Rates

Channels

Mapping

Reservations

— OPERATIONS —

Sync Center

User Management

Settings

After

Dashboard

— RATES & AVAILABILITY —

Calendar

Bulk Rates & Restrictions

Rooms & Rates

— CHANNELS —

Channels

Mapping

— OPERATIONS —

Reservations

Sync Center

— ACCOUNT —          (anchor to the bottom of the sidebar)

User Management

Settings

The moves:

- Group Calendar and the bulk screen with Rooms & Rates under Rates & Availability — this is "what I sell and at what price," the Revenue Manager's world.

- Rename "Bulk & Restrictions" to "Bulk Rates & Restrictions" (nav label and page heading).

- Move Reservations into Operations, next to Sync Center — both are "what's happening / did it work," not configuration.

- Move User Management and Settings into a bottom-anchored Account group — rarely-touched admin, not daily operations.

Optional but recommended: make each nav group's visibility follow the user's role, so a Revenue Manager sees Rates & Availability prominently and a Distribution Manager sees Channels.

## 3. Screen-by-screen

### 3.1 Dashboard

Purpose: the daily control centre — one glance answers "is anything wrong, and what needs me."

Keep

- The KPI-card layout (Connected Channels, Active Products, Unmapped Products, Pending Updates, Failed Syncs, Last Successful Sync). This is the right pattern.

- The Channel Status table, Recent Activity feed, and Latest Reservations panel.

Change

- Make every KPI card click through to its filtered destination: Unmapped Products → Mapping filtered to unmapped; Failed Syncs → Sync Center Errors; Pending Updates → the pending queue. A number the user can't act on is wasted space.

- Failed Syncs must exclude channel-capability mismatches (see §5.2). Today "CTD not supported by Expedia" inflates this count. A capability mismatch is not a failed sync.

- Pending Updates should show the age of the oldest pending item, not only the count (see §5.3). Ten updates two seconds old is healthy; ten updates two hours old means the queue is stuck.

- The Channel Status "Errors" column should reflect the same capability distinction — real errors only.

- The Recent Activity feed obeys the boundary rule (§1): channel pushes and pulls only. Entries like "Walk-in checked in" or "Unit 108 back in service" must not appear; if such an event changed availability, the feed shows the resulting availability push ("Availability updated for Studio Apartment · pushed to 5 channels"), not the operational cause.

### 3.2 Calendar

Purpose: view and edit availability, rates, and restrictions day by day, per room type.

Keep

- The two-stream layout: inventory rows (Rooms to sell, Rooms sold) separated from rate rows (Standard Rate with derived rates indented beneath it) and restriction rows (Min LOS, CTD, Stop Sell).

- Derived rates shown indented under their parent rate — this makes the derivation visible and is worth protecting.

- The colour legend (Stop Sell / CTA / CTD / Weekend) and the 7d / 14d / 30d range switch.

Change

New: collapse / expand all.

- Add a single toggle at the top of the calendar that collapses or expands every room-type section at once. Collapsed = room-type header only (optionally with the Rooms-to-sell line); expanded = full rows.

- It is one toggle whose label reflects current state ("Collapse all" ⇄ "Expand all"), not two buttons.

- Per-room collapse continues to work independently after a global collapse/expand — the global control must not fight individual sections.

- Persist collapsed/expanded state per user (this screen stays open all day; layout should survive reload).

New: rate-plan selector by name (global).

- Replace the current derived-on/off Display control with a multi-select listing every rate plan by name (Standard Rate, Non Refundable, Breakfast Rate, Long Stay Rate, Trip.com Rate, Corporate Rate, Early Booker…). The user picks exactly which rate rows appear.

- The selection is global — it applies uniformly across all room types.

- The selector governs rate rows only. Inventory rows (Rooms to sell, Rooms sold) and restriction rows (Min LOS, CTD, Stop Sell) always remain visible regardless of selection. This preserves the two-stream model: the filter acts on the rate stream, never the inventory or restriction streams.

- Keep the derivation legible: if a derived rate is shown while its parent is hidden, keep the derivation label (e.g. "−20%") on the derived row so the context isn't lost.

- Default selection = Standard Rate plus its derived rates (today's behaviour). Provide select-all / clear-all. Persist the selection per user alongside the collapse state. A "derived on/off" shortcut inside the multi-select is fine as a convenience, but the named multi-select is the requirement.

New: inline bulk update per room row.

- On each room-type row, add a bulk-update action (small button or row menu) that opens the bulk function pre-scoped to that room type. The user then sets dates, rate plan(s), and value.

- It must invoke the same underlying bulk logic and audit path as the Bulk Rates & Restrictions screen — not a parallel implementation, or the two will drift. Pre-filling the existing screen is the lower-risk build; a compact inline panel is acceptable if it calls the same code path.

- It respects the same manual/derived rule as the main bulk screen (§3.3).

Existing changes carried over:

- Put Simulate booking behind a test/demo flag so it can't appear in a production tenant. Same for any other "mock" affordance.

- Where a restriction row shows a value that a given channel will ignore, indicate that (ties to the capability map, §5.2) rather than letting the user believe it applies everywhere.

### 3.3 Bulk Rates & Restrictions

Purpose: mass-edit rates/availability across a date range, plus manage standing restriction rules (e.g. "Easter minimum stay"). Renamed from "Bulk & Restrictions" (§2).

Keep

- Preview & apply — previewing the effect before pushing is correct and should never become a one-click blind apply.

- The precedence line ("manual edit / bulk update > restriction rule > rate-plan default") — this tells the user which change wins when several overlap. Keep it visible.

- The note that a bulk run is one audit entry plus one push, and that changes propagate to derived rates automatically — but update its wording per below.

Change

New: rate-plan selection — edit any manual rate, not just Standard.

Today the bulk function edits only the Standard Rate and lets derivation cascade. That silently assumes every rate is derived from Standard, which is not true — a hotel can have several independent (manual) rates: a manually-managed corporate rate, a channel-specific rate that isn't a simple offset, a promo priced on its own. Those are currently uneditable in bulk. Fix:

- Add a rate-plan selector alongside the existing room-type selector.

- Manual (non-derived) rates are selectable and directly editable in bulk — nothing else controls their price.

- Derived rates are not directly price-editable in bulk — their price is defined by parent + offset. Either hide them from the price selector or show them disabled with a note such as "derived from Standard Rate — edit the parent." Editing the parent cascades to them exactly as today.

- Mental model: bulk price updates apply to the selected manual rate plans across the selected room types and dates; derivation cascades underneath.

- Restrictions are broader: Min LOS, CTA/CTD, Stop Sell can apply to any rate plan regardless of manual/derived, since a restriction is not a price. Keep restriction targeting selectable across all rate plans.

- Update the helper copy from hardcoded "Standard Rate" to "the selected manual rate(s)"; keep the propagate-to-derived and one-audit-entry-one-push statements.

Existing change carried over:

- In the Restriction Rules table, show which of a rule's target channels actually support that restriction type. A "Summer CTA" rule aimed at a channel that ignores CTA should be flagged, not silently created.

### 3.4 Rooms & Rates

Purpose: define the products — room types and rate plans. This is configuration, touched rarely.

Keep

- The derived-rate model with the offset shown inline (−20%, +€18, −15%) and the tags (non-refundable, breakfast, corporate). The manual-vs-derived badge on each rate plan is correct and useful — and it is now the source of truth for what the bulk function may edit (§3.3), so it must stay accurate.

Change

- Guard deletion. A room type or rate plan that is mapped to a channel cannot be deleted at the Channex level — deleting it will error. The UI should prevent deletion of a mapped product, or warn and require unmapping first, rather than letting the call fail.

### 3.5 Channels

Purpose: the per-channel view — connection status, mapping completeness, health, and per-channel settings (commission, FX markup).

Keep

- The card-per-channel layout with the mapping-completeness bar and the per-channel stats (Pending, Restrictions, FX markup).

Change

New: three quick actions, top-right of each channel card/window.

Pause — closes all dates on this channel, reversibly.

- Implementation is a stop-sell overlay, not a data wipe: push stop-sell (or zero availability) to this channel only, flag the channel as Paused, and leave the core's availability and rates untouched. Resume must restore the exact prior state instantly. Never zero or delete ARI in the core to implement Pause — then there is nothing to restore.

- Per-channel action: other channels keep selling from the shared pool.

- The button toggles to Resume while paused, and the channel is clearly badged Paused everywhere it appears (card, dashboard Channel Status) — a forgotten paused channel silently loses bookings.

- Require a confirmation (it closes revenue on that channel).

Disconnect — stops the connection and removes the channel from the active list.

- Visually separated from Pause so it can't be hit by accident; requires an explicit confirm. This is destructive to the connection.

- On disconnect: stop syncing; close out the channel so it isn't left selling with stale rates; preserve the mapping in a dormant/archived state so a later reconnect doesn't force a full remap; and never touch reservations already imported from that channel — a guest who booked via Agoda still has a valid stay after Agoda is disconnected.

Sync — manual full push of the next 365 days of ARI for this channel.

- This is the on-demand version of the nightly full sync; its purpose is recovery — forcing a drifted channel back into agreement.

- It goes through the same queue, batching, and rate-limit handling as all other pushes (a 365-day push is a lot of messages — never a direct firehose).

- Show a running state ("Syncing…" / progress) and disable the button until completion so syncs can't stack.

All three actions write to the Sync Center audit trail, attributed to the channel — these are exactly the high-consequence actions someone will later need to trace ("why did Booking.com stop selling last Tuesday?").

Existing changes carried over:

- Fix the Sync health bar. It reads "no syncs" on every card even though pushes are happening, because pushes aren't attributed to channels (see §5.1). Once pushes carry their channel, this bar becomes meaningful.

- Clarify the two different time signals on the card: "synced 3d ago" (last successful sync) and "Sync health · 24h" (rolling success rate) are different things and currently read as one.

- Distinguish a real error from a capability limitation on the card's error badge (see §5.2).

- Remove or clearly gate the "Mock" badge for production tenants.

### 3.6 Mapping

Purpose: map each Revio room type and rate plan to its counterpart on each channel.

This is the strongest screen in the product. Change as little as possible.

Keep

- The per-channel tabs, the two-column split (room types = inventory/open-close, rate plans = rates/restrictions), the external-ID display, and the "All mapped" indicator. All correct.

Change

- When a booking arrives for a room or rate that isn't mapped, Channex flags it (unmapped-room / unmapped-rate). Surface that here: an unmapped-booking alert should deep-link to the exact row that needs mapping.

- Consider offering auto-create-and-map (Channex can create the room types and rate plans on its side from the core), keeping this manual screen for admins to review and fix. This reduces the manual burden without removing control.

### 3.7 Reservations

Purpose: see bookings as they arrive.

Before changing this screen, resolve one scope question (see §5.4): in the shared-core model, the canonical reservation list lives in the CRS/PMS, and RevioLink should keep only a channel-bookings monitoring view — did the booking land, and was it acknowledged. Today this screen also shows Direct bookings and is labelled "imported from channels," which is contradictory.

Keep

- The filters (channel, status, date range) and the read-only-with-cancel-to-restore-availability behaviour.

Change

New: "Date type" filter.

Add a Date type dropdown that governs which date the existing from → to range applies to. Filter bar becomes:

[Guest or booking #] [Channel ▾] [Status ▾] [Date type ▾] [from] → [to] [Filter]

Default = Check-in (preserves today's behaviour). Options and exact logic (R1 = range start, R2 = range end, inclusive):

Option

Logic

Notes

Check-in

arrival_date BETWEEN R1 AND R2

—

Check-out

departure_date BETWEEN R1 AND R2

—

Reservation made on

created_at BETWEEN R1 AND R2

The "pickup" lens — "what did we book this week." For channel bookings, when Channex received it; for direct, when created in the core.

Cancellation date

cancelled_at BETWEEN R1 AND R2

Only cancelled reservations carry this field. When selected, auto-scope the status filter to Cancelled (or make it visually obvious only cancelled bookings can match) — otherwise an empty result looks like a bug.

Stay-in (in-house)

arrival_date <= R2 AND departure_date > R1

Overlap, not equality. Returns every reservation in-house on any night of the range. The strict > on departure is deliberate: checkout day is not a stayed night. Example: a stay 8→14 Jul must match a stay-in search 10–12 Jul. A naive equality check misses it.

Label suggestion: "Staying on" or "In-house" may read clearer to users than "Stay-in"; logic is identical.

Existing changes carried over:

- Decide and state clearly whether this is a window onto core reservations or a channel-only monitoring list, and fix the labelling to match (§5.4).

- Add an acknowledgement status column for channel bookings (received / acknowledged). A received-but-unacknowledged booking is an operational risk and should be visible here.

### 3.8 Sync Center

Purpose: the channel I/O log — and only that.

Scope (new, binding). The Sync Center shows exactly two categories:

- Outbound — ARI pushes to channels (availability, rate, restriction changes that actually went to an OTA), with their success/error state.

- Inbound — reservation pulls from channels: new bookings, modifications, cancellations, and their acknowledgements.

Nothing else qualifies. Today the Sync Center shows PMS operational events — maintenance notes ("bad smell in the room"), POS charges, walk-ins, out-of-order entries. All of these must go. They fail the boundary test (§1): they never crossed the channel boundary.

The subtle case: some operational events legitimately cause a channel push (a walk-in consumes a room; an out-of-order unit reduces availability). The Sync Center still shows the resulting availability push — "Availability reduced for Studio Apartment · pushed to 5 channels" — but never the operational cause. The action that touched a channel is in scope; the hotel event behind it is not.

Two-layer fix, per §1: correct the upstream event contract so operational payloads never reach RevioLink (the real fix), and filter the display to channel push/pull entry types only (the safety net).

Keep

- The three-tab structure (Activity / Errors / Audit Log).

- The recommendation line on each error ("Recommended: complete mapping in Channels → Mapping") — this is exactly right; every problem points at its fix.

- The severity levels (warning / critical).

Change

- Attribute activity to channels. The Channel column shows "—" on almost every row, which is why the per-channel health bars can't populate (§5.1).

- Make the recommendation actionable, not just descriptive: the mapping-error recommendation should be a link straight to the offending mapping row; a capability warning should offer "remove this restriction for this channel" or "ignore" as one click.

- Separate capability warnings from real errors (§5.2), either by grouping or a filter, so a genuine critical error (like the unmapped Corporate Rate) is never buried under noise the user has learned to ignore.

- Log the channel quick actions (Pause / Resume / Disconnect / manual Sync, §3.5) in the audit trail, attributed to channel and user.

### 3.9 User Management

Purpose: team access — invite staff, assign roles, remove access.

Keep

- The role model (Owner, Admin, Revenue Manager, Distribution Manager, Read-only) and the "every change is scoped to your hotel and audited" guarantee.

Change

- Tie roles to the new navigation groups so access maps to what each role should see: Revenue Manager → Rates & Availability; Distribution Manager → Channels (plus ARI editing); Read-only → view without edit.

### 3.10 Settings

Not captured in the screenshots, so this is guidance rather than a review. Settings is configuration, touched rarely, and belongs in the Account group. It should hold: property defaults (currency, timezone), default restrictions, the Channex connection/credentials, FX-markup defaults, and notification preferences. Keep anything a user edits daily out of Settings — that belongs in Calendar or Bulk.

## 4. Cross-cutting principles

Two rules apply across every screen:

- A red or warning state must be a doorway to its fix, and must never cry wolf. The two current violations are counting capability limitations as failures (§5.2) and showing health signals that can't populate (§5.1). Fixing those two protects the credibility of every other alert in the product.

- The boundary rule (§1). Nothing that didn't cross the channel boundary appears anywhere in RevioLink — not in the Sync Center, not in the dashboard activity feed, not in notifications.

## 5. The four cross-cutting fixes

These span multiple screens, so they're collected here.

### 5.1 Attribute every push to its channel

Symptom: per-channel "Sync health · 24h" bars read "no syncs" while the Sync Center is full of activity and the dashboard shows recent successful syncs.

Cause: push records don't carry the channel(s) they targeted (the Channel column shows "—").

Fix: every outbound push records its target channel(s). Once that data exists, the per-channel health bars, the dashboard error counts, and the channel cards all populate correctly. This is the highest-value fix because it's the most prominent broken signal. It also enables the audit-trail attribution required by the channel quick actions (§3.5).

### 5.2 Give each channel a capability map

Symptom: "CTD not supported by Expedia" appears as an error and inflates the failed-sync count.

Cause: RevioLink sends restrictions to channels that don't support them, then logs the rejection as a failure.

Fix: hold a per-channel capability map (which restriction types each channel supports). Then: don't send unsupported restrictions; show them as "not applicable on this channel" in the calendar and restriction screens; flag restriction rules targeting channels that can't honour them (§3.3); and never count a capability mismatch as a failed sync. Keep "this channel can't do this" visually distinct from "this sync broke." This stops training users to ignore red, which is how a genuine critical error gets missed.

### 5.3 Show pending age, not just pending count

Symptom: "10 pending updates" with no indication whether that's normal.

Fix: surface the age of the oldest pending item alongside the count. A growing or aging pending queue is the earliest signal that the outbound queue is stuck, and it's currently invisible.

### 5.4 Decide the reservation scope, and show acknowledgement

Two linked issues:

- Scope. In the shared-core architecture, the canonical reservation list belongs to the CRS/PMS. RevioLink should keep a channel-bookings monitoring view, not a second authoritative reservation list. Right now the Reservations screen shows Direct bookings and is labelled "imported from channels," which is contradictory. Pick one and fix the labelling.

- Acknowledgement. A booking received from a channel must be acknowledged back to Channex; an unacknowledged booking is a risk. Add acknowledgement state to the channel-bookings view so a received-but-unacknowledged booking is visible and actionable.

## 6. Change log — v2 additions from product review

For traceability, the changes introduced in this version:

- Reservations: Date type filter (Check-in / Check-out / Reservation made on / Cancellation date / Stay-in) with exact per-option logic (§3.7).

- Calendar: Collapse/expand all toggle, coexisting with per-room collapse, state persisted per user (§3.2).

- Calendar: Rate-plan multi-select by name, global across room types, rate rows only, default Standard + derived (§3.2).

- Rename to Bulk Rates & Restrictions (§2, §3.3).

- Bulk: rate-plan selector; all manual rates bulk-editable, derived rates edited via their parent only; restrictions targetable across all plans (§3.3).

- Calendar: inline bulk update per room row, same logic and audit path as the main bulk screen (§3.2).

- Channels: Pause (reversible stop-sell overlay with Resume and Paused badge), Disconnect (confirm; dormant mapping; imported reservations untouched), Sync (365-day full push through the normal queue, with running state) (§3.5).

- Sync Center: scope narrowed to channel I/O only — ARI pushes and reservation pulls; PMS operational events (maintenance, POS charges, walk-ins) removed at source and filtered at display (§3.8, §1).

- Boundary rule promoted to a core principle in Orientation (§1) and applied to the dashboard activity feed (§3.1).

## 7. Glossary (for the developer)

- ARI — Availability, Rates, and Restrictions. The three things RevioLink pushes out to channels.

- Room type vs rate plan — a room type is a category of room (e.g. Deluxe Double) and carries inventory; a rate plan is a price-and-rules package sold on that room type (e.g. Non-Refundable). A rate plan always belongs to a room type.

- Manual vs derived rate — a manual rate is priced independently; a derived rate is defined as an offset from a parent (e.g. Standard −20%) and updates automatically when the parent changes. Only manual rates are ever edited directly.

- BAR / Standard Rate — "Best Available Rate," the hotel's main public rate. Other rate plans are often (not always) derived from it.

- Min LOS / Max LOS — minimum / maximum length of stay allowed for a booking.

- CTA / CTD — Closed To Arrival / Closed To Departure. A guest may not start (CTA) or end (CTD) a stay on that date. Not every channel supports both.

- Stop Sell — close a room type or rate for sale on given dates without deleting it.

- Release / booking window — how far in advance (or how close to arrival) a booking is allowed.

- Delta sync vs full sync — a delta pushes only what changed; a full sync pushes everything. RevioLink sends deltas continuously and a full sync rarely (typically once a day, off-peak, plus the manual 365-day Sync action).

- Acknowledgement (ack) — confirming back to Channex that a booking was received. Unacknowledged bookings are flagged and re-notified.

- Booking revision — Channex represents each version of a booking (new, modified, cancelled) as a full snapshot. A modification is a fresh snapshot, so generally replace rather than merge.

- Pooled inventory — all channels draw from one shared availability pool (first-come-first-served), rather than each channel getting a fixed allocation. This is the modern default and is what makes fast availability pushes matter for overbooking prevention.

- FX markup — a percentage added when a channel sells in a currency other than the property's base currency.

- Pending / outbox — updates queued to go out to Channex but not yet confirmed sent. The count is queue depth; the age of the oldest item is the real health signal.

- In-house / stay-through — a reservation is in-house on a date if the guest sleeps there that night: arrival ≤ date < departure. The departure day itself is not a stayed night.