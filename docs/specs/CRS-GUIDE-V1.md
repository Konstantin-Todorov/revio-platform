# RevioCRS — Interface, Navigation & Feature Guide (v1)

> Founder spec, received 2026-07-09. Source: "RevioCRS - Optimisations.pdf" (13 pages), transcribed to markdown.
> The PDF's nav screenshot shows: CURRENT (Dashboard, Reservations, Guests, Inventory Calendar, ~~Rates & Restrictions~~ [split ×3], Reports [→ Analytics], ~~Inventory Setup~~ [merged], Distribution, Settings) vs PROPOSED (Overview: Dashboard, Analytics [was Reports] / Bookings: Reservations, Guests / Inventory & Rates: Inventory Calendar, Rooms & Rates [new], Bulk Rates & Availability [new] / Configuration: Distribution, Settings).

A working spec for the RevioCRS product. Written to be read top to bottom by a developer who is new to hotel distribution and revenue, so domain terms are explained inline and collected in a glossary at the end.

The CRS is already a strong product — the metric discipline, the availability waterfall, the precedence model, and the single-channel-manager architecture are all correct. Most of this guide is refinement plus a set of new tabs. As in the RevioLink guide, each screen is split into **Keep** (correct, must survive any refactor) and **Change** (specific edits). Treat "Keep" as binding.

## 1. Orientation for the developer

### 1.1 What the CRS is

RevioCRS is the **commercial brain**. It owns *what is for sale*: room types, rate plans, restrictions, promotions, availability, and the reservation at origination. It is **central** — it sits above the properties, one CRS serving a whole hotel group — and it connects to the outside world through **exactly one channel manager** (RevioLink by default, or a third-party channel manager, handled through the identical connector). The CRS never talks to an OTA directly.

The CRS is **not** the operational system (that's the PMS: front desk, housekeeping, folios, physical room assignment) and **not** a CRM.

### 1.2 Standalone vs integrated — a load-bearing distinction

RevioLink can run **without** the CRS. Some properties buy RevioLink alone to control their OTA extranets, with booking notifications delivered by email. This gives two deployment modes, and several behaviours below are gated on which one is in play:

- **Standalone (RevioLink only):** RevioLink owns the commercial definitions and channel bookings terminate in RevioLink (stored there and/or emailed to the property). There is no CRS reservation record.
- **Integrated (RevioLink + CRS):** the CRS is an optional layer on top. Both products read and write the **same shared core**. The CRS owns the canonical reservation; RevioLink becomes the channel-monitoring view.

Commercially this is a ladder: sell RevioLink alone, upsell the CRS when the property wants central reservations.

> Note for the docs set: the Hierarchy page currently states "RevioLink holds no business truth." That line is now superseded — in standalone mode RevioLink **does** own the commercial definitions. The Hierarchy page needs a standalone-vs-integrated addendum so it doesn't contradict this. *(Done — see `HIERARCHY.md` §6.)*

### 1.3 The one-record rule

Because room types and rate plans are authored in **both** products, the invariant that keeps this safe:

> **There is one room-type record and one rate-plan record in the shared core. RevioLink and the CRS are two edit surfaces onto the same record — never two tables that sync.**

In standalone mode RevioLink is the sole author. When the CRS joins, it edits the *same* records. If a developer ever builds a separate "CRS room types" table reconciled against a "RevioLink room types" table, that is the failure — the same swamp as a CRS↔PMS reservation sync. One record, two windows.

### 1.4 The precedence model — two tiers

Rates, restrictions, and open/close status resolve through **two tiers**, not four ranked levels:

**Standing defaults** (product-level, no dates):

- A default set on a **rate plan** (in Rooms & Rates) — e.g. Long Stay Rate carries min-stay 5 nights.
- The **property default** (in Settings) — the catch-all fallback.
- Between these two, the more specific wins: **rate-plan default overrides property default**.

**Date-scoped edits** (attached to actual dates):

- Any rate, restriction, or open/close value set for specific dates, entered via **Inventory Calendar** or via **Bulk Rates & Availability**.
- These always override the standing defaults for the dates they cover.
- **Calendar and bulk are peers — last write wins by recency.** A later bulk run overrides an earlier calendar edit on the same date, and vice versa. There is **no** fixed "manual beats bulk" ranking; only *when* the edit happened.

Resolution for any date + rate plan: is there a date-scoped value (most recent of calendar/bulk)? → use it. Else a rate-plan default? → use it. Else the property default.

**Implementation consequence:** every date-scoped value must carry a **last-modified timestamp** and ideally the surface that wrote it, or "last write wins" has nothing to compare and the audit trail can't explain which edit won.

The displayed precedence line should read (wherever a user edits ARI):

> date-scoped edit (calendar or bulk — most recent wins) → rate-plan default → property default

### 1.5 The boundary rule

The CRS deals in **commercial** state only. It does **not** own or compute operational data — POS charges, maintenance, walk-ins, housekeeping, physical room assignment. The CRS may **display** such data when the PMS/POS writes it to the shared core, but it never authors or calculates it. In standalone or CRS-without-PMS deployments those fields are simply empty.

Anything that reads like a housekeeping or POS event appearing on a CRS screen is a boundary violation, not a feature. (This is why operational events must be removed from the Distribution activity feed — see §3.8.)

### 1.6 What the CRS can and cannot compute

The CRS derives metrics from **reservations + inventory** (never stored separately — always calculated). That means:

**It can build:** occupancy, ADR, RevPAR, revenue, room-nights, pickup & pace, source/channel mix, room-type and rate-plan performance, cancellations, and on-the-books/forecast.

**It cannot build without external data** (leave out, or mark "requires channel data"): gross conversion rate and traffic (need OTA page-views — a CRS has no concept of a "view"), competitive-set / rate observation (needs a rate-shopping feed), and review score (needs a reputation source). These appear in OTA extranet analytics because the OTA has that data; the CRS does not.

## 2. Navigation — regrouping

Sort the screens by mode (overview / bookings / commercial control / configuration) and dissolve the overloaded "Rates & Restrictions" screen into its three natural homes.

**Before**

```
Dashboard
Reservations
Guests
Inventory Calendar
Rates & Restrictions
Reports
Inventory Setup
— CONFIGURATION —
Distribution
Settings
```

**After**

```
— OVERVIEW —
Dashboard
Analytics                  (was Reports, expanded)
— BOOKINGS —
Reservations
Guests
— INVENTORY & RATES —
Inventory Calendar
Rooms & Rates              (new — product authoring; absorbs Inventory Setup)
Bulk Rates & Availability  (new — date-scoped ARI; absorbs restriction rules)
— CONFIGURATION —
Distribution
Settings
```

The dissolution of **Rates & Restrictions** (three-way split, nothing stranded):

- Room types + rate plans → **Rooms & Rates**
- Standing policy defaults (the "level-4 fallback" block) → **Settings**
- Restriction rules (date-scoped) → **Bulk Rates & Availability**

**Inventory Setup** (physical counts, out-of-order / closure periods) merges into **Rooms & Rates**.

This pulls the CRS into near-symmetry with RevioLink across the Inventory & Rates group — CRS *Inventory Calendar · Rooms & Rates · Bulk Rates & Availability* mirrors RevioLink *Calendar · Rooms & Rates · Bulk Rates & Restrictions* — which is a real benefit for anyone running both.

## 3. Screen-by-screen

### 3.1 Dashboard

Purpose: the daily control centre for one property (or the group — see §4.1).

**Keep**

- The "every number from the shared formula sheet" discipline and the canonical KPI set (Occupancy, ADR, RevPAR, Pickup, cancellation, room-nights, revenue).
- The Forecast card's honest labelling ("expected values from confirmed bookings — not a prediction model"), source-mix card, and Action Center.

**Change**

- **Period presets, renamed and disambiguated.** Replace the current ambiguous "7 days / 30 days" with: **Custom, L7D, L28D, YTD, N7D, N28D, Today, Tomorrow**. Use **28, not 30** — 28 days is four whole weeks, so week-over-week and year-over-year comparisons aren't distorted by day-of-week mismatch. A developer must not "tidy" this back to 30.
- **Past vs future are different kinds of number.** L7D/L28D/YTD are *actuals* (realized performance). N7D/N28D/Tomorrow are *on-the-books* (confirmed reservations only — the future has no realized occupancy). When a forward period is selected, labels must shift to on-the-books language ("Revenue on the books," "committed occupancy"), exactly as the Forecast card already does.
- **Customizable presets.** Let the user enable/disable which period presets show, and which KPI cards show — saved as a **per-user** preference (not per-property). This is the "let the customer set his own view" requirement.
- **Year-over-year on every KPI**, with visual treatment: gain = green, up-arrow, %; drop = red, down-arrow, %. This benchmarks the property against its own past. Comparison basis is **STLY = 364 days back (52 weeks), not 365** — the 364-day shift preserves day-of-week (Saturday vs Saturday). See §4.2.
- KPI cards click through to their filtered source (Occupancy → calendar, Cancellation → cancelled reservations, etc.).

### 3.2 Analytics (new — expands "Reports")

Purpose: a dedicated analytics tab with sub-tabs, replacing the single Reports screen.

**Sub-tabs (all CRS-native — build these):**

- **Performance** — occupancy, ADR, RevPAR, revenue, room-nights, with YoY.
- **Pickup & Pace** — the booking curve into a target stay period (how bookings accumulated over time).
- **Source / Channel mix** — revenue and room-nights by Direct / OTA / Call Centre / Travel Agent.
- **Room-type & Rate-plan performance** — nights, revenue, ADR per product (the "detailed performance by room type" table style).
- **Cancellations** — rate, lead-time-to-cancel, by source.
- **On-the-books / Forecast** — committed future performance.

**Do NOT build (require external data the CRS lacks):** Traffic Analysis, Gross Conversion Rate, Market & Users, Competitive Set / Rate Observation, Review Score. If ever added, they must be labelled "requires channel data" and fed from an external source, not fabricated.

**Global controls, present across every sub-tab (all CRS-native):**

- **Book date vs Stay date** toggle — production lens (when it was booked) vs occupancy lens (when the stay falls). The same distinction as the reservations Date-type filter.
- **Source / channel filter.**
- **Granularity** — daily / weekly / monthly.
- **Period + Compare-to** (YoY on the STLY basis above).

Keep Export CSV. Apply the green/red YoY visual treatment throughout.

### 3.3 Reservations

Purpose: the canonical system of record — every booking from every source (integrated mode).

**Keep**

- The system-of-record framing, the New reservation action (direct/call-centre/manual origination), and the filters.

**Change**

- **Add the "Date type" filter** (same spec as RevioLink §3.7): Check-in / Check-out / Reservation made on / Cancellation date / Stay-in, governing the from→to range. Default Check-in. Stay-in uses the overlap query (`arrival <= R2 AND departure > R1`); Cancellation date auto-scopes to cancelled status.
- **Surface the full lifecycle.** Today every row reads "confirmed," but the model is Draft → Hold → Confirmed → Archived (plus Expired, Failed). A **Hold** with a live TTL countdown is actionable and must be visible, not hidden behind "Any status."

### 3.4 Guests

Purpose: contact details + booking history — deliberately not a CRM.

**Keep**

- The not-a-CRM scoping and search. Resist growing this into a marketing tool.

**Change — add a light preference layer, respecting the boundary:**

- **CRS-derivable preferences** (build these — computed from booking history): preferred room *type*, average length of stay, average lead time, booking frequency, lifetime accommodation revenue, cancellation/no-show behaviour.
- **PMS/POS-sourced fields** (display-only, never computed by the CRS): average additional spend from POS, and physical-room preferences. These come from the shared core when a PMS/POS writes them; in standalone or CRS-without-PMS they are simply empty. Do not attempt to compute POS spend in the CRS — that's the boundary violation we removed from RevioLink.
- Be deliberate: this is the edge of "not a CRM." A light preference layer is fine; a segmentation/marketing engine is out of scope.

### 3.5 Inventory Calendar

Purpose: view and edit availability, rates, restrictions per room type — with the full waterfall exposed.

**Keep — and protect**

- The **full availability waterfall** per day: Physical → Out of order → Closed → Available → Sold → Remaining. This is the best single screen in either product; it makes availability legible instead of a black box. It is **richer** than RevioLink's calendar and must not be flattened.

**Change — align to RevioLink, additively (do not remove the waterfall):**

- **Collapse / expand all** — one toggle whose label reflects state; per-room collapse still works independently; state persisted per user.
- **Global rate-plan multi-select by name** — pick which rate rows show, across all room types. Governs **rate rows only**; the inventory rows (the waterfall) and restriction rows stay pinned regardless.
- **Inline per-row bulk update** — a bulk action on each room-type row, pre-scoped to that room, invoking the **same logic and audit path** as Bulk Rates & Availability (not a parallel implementation).

### 3.6 Rooms & Rates (new)

Purpose: the single product-definition surface — what the property sells and how much of it exists. Absorbs the old Rates & Restrictions rate-plan section and the whole of Inventory Setup.

**Contents:**

- **Room types** with physical counts, code, unit, max guests (from Inventory Setup).
- **Rate plans** — manual and derived, with per-plan pricing, policy (cancellation), and **rate-plan-level defaults** (e.g. min-stay). These per-plan defaults are the "rate-plan default" tier of the precedence model (§1.4).
- **Out-of-order / closure periods** (from Inventory Setup).

**Rules and guards**

- **One-record rule (§1.3):** authoring here writes the same shared-core records RevioLink authors. Never a separate table.
- **Standing property defaults do NOT live here** — those are in Settings. Only *product* definitions and *per-rate-plan* defaults live here.
- **Deletion guard:** a room type or rate plan mapped to a channel manager cannot be deleted (the CM call will fail). Prevent deletion of a mapped product, or require unmapping first.
- **OOO boundary:** when a PMS exists, out-of-order originates in the PMS and the CRS reads it. Authoring OOO here is the pragmatic path for standalone/independent use; keep the distinction between commercial **closure** (CRS decision) and operational **out of order** (PMS fact) in mind.

### 3.7 Bulk Rates & Availability (new — the ARI-management tab)

Purpose: date-scoped ARI editing. The CRS twin of RevioLink's Bulk Rates & Restrictions, with open/close status added (hence "Availability").

**Function:**

- Pick a **date range from a calendar**, then set **rate**, **restrictions**, and **rate-plan status (open/close)** together in one operation.
- **Restriction rules** (date-scoped, source-targetable — e.g. "closed to Travel Agents") move here from the old Rates & Restrictions screen. Keep the source-level targeting; it's a CRS capability RevioLink doesn't have.

**Rules**

- Only **manual** rates are directly price-editable; **derived** rates recalc from their parent (edit the parent). Same rule as RevioLink.
- Preview before apply; one run = one audit entry.
- Display the precedence line here (§1.4), reflecting the two-tier model — **not** the old "manual > bulk" ranking.

Naming note: RevioLink's equivalent is "Bulk Rates & **Restrictions**"; the CRS's is "Bulk Rates & **Availability**" because it adds open/close. Acceptable to differ; align if you'd rather they read identically across the suite.

### 3.8 Distribution

Purpose: connect the CRS to exactly one channel manager, and map to it.

**Keep**

- The architecture assertion: the CRS never talks to an OTA; everything flows through one channel manager; a third-party CM plugs into the identical connector, never a second code path. This framing is correct — protect it.

**Change**

- **Channel-manager selection / switching.** Support choosing the connected CM — RevioLink (internal) or a third-party (SiteMinder, RoomRaccoon, …).
- **CRS ↔ CM mapping (new sub-menu).** Two distinct mapping layers that must not be blurred:
  - **CRS ↔ channel manager** mapping lives *here*. When the CM is RevioLink (internal), it's automatic — shared core, same records, nothing to map. When it's a third-party CM, the user explicitly maps CRS room types ↔ the CM's rooms.
  - **Channel manager ↔ OTA** mapping stays *inside the channel manager* (RevioLink's Mapping screen), never in the CRS.
- **Pause / disconnect** at the CM-connection level: pausing stops distribution reversibly; disconnecting preserves the CRS↔CM mapping in a **dormant** state so resuming never forces a re-map.
- **Slim the duplicated sync view.** Today this page reproduces RevioLink's Sync Center (activity feed + error queue) and inherits its operational-event leak ("Walk-in checked in," "Unit 108 back in service"). Reduce it to: which CM is connected, which channels it distributes to, a one-line health summary, and a link into the channel manager for detail. **Remove operational events entirely** (§1.5) — they never crossed a channel boundary and don't belong on any CRS screen.

### 3.9 Settings

Purpose: configuration touched rarely — roles, taxes, property profile, and the standing policy defaults.

**Keep**

- The role×permission matrix (group×level model) and the Taxes & Fees framework with in-displayed-rate handling.

**Change**

- **Add the standing policy defaults block** (moved from the dissolved Rates & Restrictions): default min-stay, max-stay, booking windows (book ≥ / ≤ days ahead), hold TTL, low-availability alert threshold, pickup-compare window, revenue display (gross/net), count-no-shows-as-sold. These are the property-default tier of the precedence model (§1.4).
- **City-tax mode** — payable-on-spot vs included (see §4.4).
- Roles are defined here; user assignment happens in RevioLink → User Management (one account across every Revio product). Keep that split clear.

## 4. Cross-cutting features

### 4.1 Group / portfolio view

The CRS is multi-property but not yet *central*. Add a **group-scope layer above the property selector** — a third entry ("All properties" / the group name) sitting above the individual properties in the existing selector. Selecting it puts the app into group scope; selecting a property drops back to today's single-property scope. No new navigation concept — the selector becomes the level switch.

**Phase one:** group scope drives **Dashboard** and **Analytics** only. Operational screens (Inventory Calendar, Rooms & Rates, Bulk Rates & Availability, reservation editing) remain single-property; entering them in group scope prompts for or auto-selects a property.

**Later phase:** portfolio-aware operational screens (cross-property reservation list, group-level rate actions). Flagged, not built now.

**Metric aggregation — do not average averages.** Sums roll up directly (room-nights, revenue, arrivals). **Ratios must be recomputed from summed numerators and denominators:** group occupancy = Σ sold room-nights ÷ Σ available room-nights; group ADR = Σ revenue ÷ Σ rooms sold; group RevPAR = Σ revenue ÷ Σ available room-nights. Averaging each property's percentage gives wrong numbers. The "never stored separately — always calculated" principle makes this natural: the group view just widens the calculation scope.

### 4.2 Year-over-year benchmarking

Every KPI on the Dashboard and in Analytics compares to the same period last year, with visual treatment: gain = green + up-arrow + %, drop = red + down-arrow + %.

**Convention:** "same period last year" = **364 days back (52 weeks), not 365.** The 364-day shift preserves day-of-week, so a Saturday compares to a Saturday. This is the STLY standard; comparing to the same calendar date mismatches weekdays and makes every delta subtly wrong.

### 4.3 The precedence model (build reference)

See §1.4 for the full definition. Build summary:

- Store every **date-scoped** value with a last-modified timestamp and source (calendar/bulk).
- Resolution: most-recent date-scoped value → rate-plan default → property default.
- Calendar and bulk are peers (recency decides); rate-plan default beats property default (specificity decides).
- Display the two-tier line wherever ARI is edited.

### 4.4 City tax — one definition, three products

The anchor invariant: **the city-tax setting never changes the rate exported to the channel manager.** The rate sent to the OTA is the room rate, full stop. The setting only controls downstream behaviour:

- **Payable on spot:** the PMS posts city tax as a **separate folio charge** after check-in; **and** the channel manager sends the OTA a "tax payable at property" **disclosure** (amount + basis) so the guest is warned before booking. The disclosure informs the guest; it does **not** enter the sellable rate.
- **Included:** no separate folio line, no payable-at-property disclosure; the hotel absorbs the tax within the existing rate, which stays unchanged.

Framing for the developer: the **CRS defines** the tax rule (mode, amount, basis), the **PMS applies** it to the folio at check-in, and the **channel manager discloses** it to the OTA — one definition, three products, rate untouched throughout.

Caveat: sending a "payable at property" tax field to an OTA depends on the channel manager and OTA supporting it (available via Channex for many OTAs, not all). Treat it as a capability to verify per channel, not a guarantee. If an OTA can't accept the disclosure, surface that so the property knows the guest won't be pre-informed on that channel.

### 4.5 Boundary hygiene (applies across the CRS)

- No operational events (POS, maintenance, walk-ins, housekeeping) on any CRS screen — remove them from the Distribution feed (§3.8) and never add them elsewhere.
- When an operational fact legitimately changes availability (out-of-order, walk-in consuming a room), the CRS shows the **availability effect**, never the operational cause.

## 5. Change log — v1

1. Navigation regrouped into Overview / Bookings / Inventory & Rates / Configuration (§2).
2. Rates & Restrictions dissolved three ways: products → Rooms & Rates, standing defaults → Settings, restriction rules → Bulk Rates & Availability (§2).
3. Reports → Analytics, with CRS-native sub-tabs; external-data reports explicitly excluded (§3.2).
4. Inventory Setup merged into Rooms & Rates (§3.6).
5. New Rooms & Rates tab — product authoring, one-record rule (§3.6).
6. New Bulk Rates & Availability tab — date-scoped ARI incl. open/close (§3.7).
7. Dashboard period presets (Custom, L7D, L28D, YTD, N7D, N28D, Today, Tomorrow), past-vs-future labelling, per-user customization (§3.1).
8. YoY benchmarking on every KPI, STLY 364-day basis, green/red visual treatment (§3.1, §4.2).
9. Reservations: Date-type filter + full lifecycle incl. Hold TTL (§3.3).
10. Guests: CRS-derived preference layer; POS/physical-room fields display-only from shared core (§3.4).
11. Inventory Calendar aligned to RevioLink (collapse/expand, rate-plan multi-select, inline bulk) — waterfall preserved (§3.5).
12. Distribution: CM switching, CRS↔CM mapping sub-menu, reversible pause/disconnect with dormant mapping, sync-view slimmed, operational events removed (§3.8).
13. City-tax payable-on-spot vs included, rate-export invariant, three-product flow (§4.4).
14. Group/portfolio scope layer; ratio metrics recomputed not averaged (§4.1).
15. Two-tier precedence model refined (calendar/bulk peers by recency; rate-plan default > property default) (§1.4).

## 6. Glossary (for the developer)

- **ARI** — Availability, Rates, and Restrictions.
- **Availability waterfall** — Physical rooms → minus Out-of-order → minus Closed → Available → minus Sold → Remaining. The chain that produces sellable availability.
- **On-the-books** — confirmed future business (reservations already made for future dates). Not a forecast/prediction; the future has no realized occupancy, so forward metrics use on-the-books language.
- **Pickup & Pace** — how bookings for a target stay period accumulated over time (the booking curve). "Pickup" = new bookings gained since a prior point.
- **STLY (same time last year)** — the comparison baseline, taken **364 days** back to preserve day-of-week.
- **ADR / RevPAR / Occupancy** — revenue ÷ rooms sold; revenue ÷ available room-nights; sold ÷ available room-nights. At group level, recompute from summed numerator/denominator — never average per-property percentages.
- **Manual vs derived rate** — a manual rate is priced independently; a derived rate is a parent ± offset and recalcs automatically. Only manual rates are edited directly.
- **Standing default vs date-scoped edit** — standing = product-level, no dates (rate-plan default, property default); date-scoped = attached to actual dates (calendar or bulk). Date-scoped always wins for its dates.
- **Rate-plan default / property default** — the two standing tiers; rate-plan (more specific) beats property (catch-all).
- **Hold / Hold TTL** — a reservation held temporarily (e.g. during checkout) that expires after the TTL if not confirmed.
- **Book date vs Stay date** — filter/lens: when a reservation was made vs when the stay occurs. Production analysis uses book date; occupancy analysis uses stay date.
- **Standalone vs integrated** — RevioLink alone (bookings by email, no CRS record) vs RevioLink + CRS (shared core, CRS owns the reservation).
- **City tax: payable on spot vs included** — payable on spot = folio charge after check-in + OTA disclosure, rate unchanged; included = absorbed in the rate, no folio line, no disclosure, rate unchanged. The tax setting never changes the exported rate.
