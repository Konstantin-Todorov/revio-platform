# August 2026 specs — implementation tracker

Every item from the three documents in `docs/specs/inbox/`, enumerated so none is lost. Sections
reference the source docs; open them for the full reasoning rather than duplicating it here.

**Source:** `CRS Updates 08` · `Link - CM - updates 08` · `Revio Website changes`

Status: ☐ open · ◐ in progress · ☑ done

---

## A. Company identity — bilingual (asked directly, 2026-08-24)

- ☑ **A1** Legal name stored in **both Cyrillic and Latin**; the invoice picks by the customer's
  country — a Bulgarian buyer gets `Уебър БГ ЕООД`, everyone else `WEBER BG EOOD`. Both are
  legitimate; the document should not look like two different companies.
- ☑ **A2** Same for the registered address, or an invoice reads half in one script and half in the other.
- ☑ **A3** Post code is **7002** (the website draft says 7000 — the draft is wrong).

## B. Channex sync

- ☑ **B1** Parse `meta.warnings` — Channex rejects values inside an HTTP 200. Verified live, fixed,
  deployed. *(CRS §6.7a / CM L7)*
- ☐ **B2** Rate value convention: integer minor units everywhere, never a decimal string. *(§6.7a)*
- ☐ **B3** Reject a rate ≤ 0 before sending rather than learning it from a warning. *(§6.7a)*

---

## C. RevioCRS — Dashboard *(§1)*

- ☐ **C1** *(§1.2)* "Occupancy & revenue by day" renders **nothing** on load. Default to a 30-day
  window; never blank. **Dual axis** — occupancy as a line (left, %), revenue as bars (right, €).
  Both on by default; legend click mutes either. Not a toggle: the gap between them is the insight.
- ☐ **C2** *(§1.3)* Source mix is bars-as-rows. Make it a composition visual (donut or stacked) over
  **all** sources, each carrying its **cost of distribution** — the 2% vs 15–18% story. Plain chart
  may ship first; the net-of-commission layer is additive.

## D. RevioCRS — Analytics *(§2)*

- ☑ **D1** *(§2.0)* **Mandate: no data grids.** Every panel a visual. Two guarantees that keep the
  "defend a number" job intact: every visual carries **data labels** on the mark (not tooltip-only),
  and **Export CSV stays on every tab**. Row-level detail routes to Reservations (`status = cancelled`
  already exists) and the CSV.
- ☑ **D2** *(§2.2)* Performance: room-type table → horizontal bars, sorted by revenue, room-nights
  and ADR as labels.
- ☑ **D3** *(§2.2)* Pickup & Pace → **pace curve**: sold-now and sold-at-snapshot as two lines, the
  gap shaded (green when positive).
- ☑ **D4** *(§2.2)* Source/Channel → donut + **net-after-commission** bar.
- ☑ **D5** *(§2.2)* Room-type & Rate-plan → two bar charts.
- ☑ **D6** *(§2.2)* Cancellations → gauge/big number carrying both framings; drivers as small
  visuals; the reservation list **leaves Analytics entirely**.
- ☑ **D7** *(§2.2)* Availability grid → **heatmap**, cell coloured by remaining as % of capacity,
  count kept as the label. Biggest single upgrade in the module.
- ☑ **D8** *(§2.2)* On-the-books → add the missing hero: a **forward horizon curve** (committed
  occupancy/room-nights, next 30 days). Also defuses a trust trap — identical 7d/30d cards read as a
  failed recompute when they are simply correct.
- ☑ **D9** *(§2.2)* Forecast disclaimer wording **identical, word for word**, to the Dashboard's.
- ☑ **D10** *(§2.3)* "Low" availability is an absolute `≤ 2` — wrong at scale (2 of 3 suites is 67%
  free; 2 of 40 is nearly sold out). Make it **% of room-type capacity**. Now load-bearing: it is the
  heatmap's colour scale. Same for **overbooked**.
- ☑ **D11** *(§2.5)* **OTA empty state lies.** It reports "commission paid €0 · no OTA revenue" when
  there *is* €780 of OTA revenue and the rate is merely unconfigured — then treats an unset rate as
  0% and reports distribution as free. Three-way state; suppress "revenue kept" when the rate is
  unset. Never render an unconfigured rate as €0 paid.
- ☑ **D12** *(§2.6)* **Cancellations computes on book-date but displays stay-date chips.** Either
  obey the lens like every other tab, or hard-wire to book-date, grey the toggle and label the
  denominator in words.
- ☑ **D13** *(§2.7)* Availability header says "next 30 days", renders 29 columns.

## E. RevioCRS — Reservations *(§3)*

- ☑ **E1** *(§3.3)* **Date fields only open the picker from the calendar icon.** `showPicker()` on
  click/focus, **everywhere native date inputs appear** — new-reservation search, reservations
  filter, bulk-edit modal (§5.4). Highest-frequency annoyance; do first.
- ☐ **E2** *(§3.3)* Better fix: a two-month **range picker** for arrival→departure.
- ☐ **E3** *(§3.2)* Known-booking **bypass** — guest-first entry, converging on the same
  hold → details → confirm tail. Search-first stays the default.
- ☐ **E4** *(§3.2)* Show **rate plans at the shop step**, not only after hold — agents upsell on rate choice.
- ☐ **E5** *(§3.1 build note)* Confirm holds carry a TTL. *(believed already true — verify)*

## F. RevioCRS — Guests *(§4)*

- ☐ **F1** *(§4.2)* **"Book again" on the profile** — the concrete home for E3. Highest-leverage add.
- ☐ **F2** *(§4.3)* **Guest merge / de-duplication.** Pick the survivor, fold history/notes/
  preferences/privacy, keep an audit trail. Cheap now, painful once duplicates exist.
- ☐ **F3** *(§4.4)* **Low-sample labels.** "Average stay 3.0 nights" from ONE stay claims a pattern
  that does not exist. Below a threshold say "Last stay", or annotate the sample.
- ☐ **F4** *(§4.5)* Hydrate contact fields from the most recent linked reservation carrying a value.
  **Enrich empty · never overwrite · tag OTA-sourced as an alias** — OTA relay addresses are fine for
  messaging and are not ground truth. Powers the F1 prefill.
- ☐ **F5** *(§4.6)* Do **not** apply the Analytics visual mandate here. No charts on a guest profile.

## G. RevioCRS — Inventory Calendar *(§5)*

- ☐ **G1** *(§5.2)* Restrictions row renders a bare "." — **badges** instead (MIN 2, CTA, CTD, closed).
  Biggest at-a-glance weakness.
- ☐ **G2** *(§5.2)* Grade the Remaining row by pressure, reusing D10's relative threshold. Subtle
  shading only — it must stay editable.
- ☑ **G3** *(§5.3)* **Make the derived cascade explicit** — one line: *"Derived plans follow Standard
  — change it and they recompute."* One line, and it is the difference between the feature feeling
  clever and feeling risky. **Do first.**
- ☐ **G4** *(§5.3)* **Tab the bulk modal** — Rates | Availability | Restrictions.
- ☐ **G5** *(§5.3)* Co-locate rate-plan selection with the Price control.
- ☐ **G6** *(§5.3)* Unit-aware Value field (€/%) with an inline result, and a Preview that spells out
  the blast radius including every derived recompute.
- ☑ **G7** *(§5.4)* "Set exact price" must say it sets the **master only**.

---

## H. Occupancy-Based Pricing *(CRS §6 + all of CM L1–L11)*

**A core data-model change**, not a screen refinement: rate goes from `(room type, rate plan, date)`
to `(room type, rate plan, date, occupancy)`. Per-room becomes the one-row special case, so both
models share one schema.

> *Every surface that quotes, displays, syncs, or bills a rate must become occupancy-aware. One
> per-room surface left behind produces the classic parity failure — guest sees one price on the
> booking engine, the OTA shows another, the folio bills a third.* — §6.6

Build order is fixed by §6.11 / L10 and should not be reordered:

- ☐ **H1** Data model — occupancy dimension on rates; `pricing_model` + `primary_occupancy` on plans;
  `max_occupancy` + `default_occupancy` on room types. *(§6.3)*
- ☐ **H2** Settings — property default + per-plan override, seed modes, display pref, age policy
  scaffold, CM capability flag. *(§6.2)*
- ☐ **H3** Channex sync — `sell_mode`, occupancy `options`, `rate_mode` incl. **cascade**, the daily
  `rates[]` push, batching, warnings. *(§6.7 / §6.7a / L7)*
- ☐ **H4** Bulk-edit occupancy matrix + primary-plus-offsets. Mixed max across room types: render to
  the highest cap, **skip** beyond each type's own max. *(§6.4 / L4)*
- ☐ **H5** Calendar per-occupancy display — expand-on-demand or compact inline. **Never** N permanent
  rows per plan. *(§6.5 / L3)*
- ☐ **H6** Rate resolution by guest count — CRS quoting **and** RevioDirect. *(§6.6)*
- ☐ **H7** PMS — folio line at the occupancy rate, re-resolve when occupancy changes mid-stay, room
  moves/upgrades re-price, walk-ins quoted at occupancy, night audit posts the occupancy rate. *(§6.6)*
- ☐ **H8** RevioLink inbound — capture occupancy on channel bookings so the folio reconciles. *(§6.6 / L8)*
- ☐ **H9** Mapping — occupancy options + **primary-occupancy selector**; completeness redefined so
  "All mapped" cannot show green with occupancies unmapped. *(L5)*
- ☐ **H10** Channels — per-channel occupancy capability on the limitations line; degrade single-rate
  channels to primary + extra-guest. *(L6)*
- ☐ **H11** Link authorship/precedence + connection state (CRS-linked vs standalone). Governs **all**
  rates, not just occupancy. *(L1)*
- ☐ **H12** Dashboard — Active/Unmapped Products count occupancy mapping. *(L9)*
- ☐ **H13** Migration — existing plans to a single max-occupancy option; model switch is a **sync
  event**, not a local config change. *(§6.10)*
- ☐ **H14** *(later)* Children / infants axis — do **not** fold into adult occupancy. *(§6.9)*

### Decisions — all answered 2026-08-24, see `docs/SPEC-08-DECISIONS.md`
- ☑ **(a)** Model **single-owned** by the CRS, not conflict-resolved. Toggle disabled in Link with a
  "managed by your CRS" note. A value conflict is recoverable; a model mismatch is incoherent.
- ☑ **(b)** Link edits apply immediately, are reasserted by the CRS, and are **logged and visible**.
  ⚠️ The reassertion must **re-push to channels**, or the OTA keeps selling the stale Link value.
- ☑ **(c)** Rides the channel-limitations line. **Not an L1 blocker** — channels/sync layer only.

---

## I. Website *(Revio Website changes)*

Full copy replacement, in page order. Repo: `revio-websites`.

- ☐ **I1** Homepage — hero, three products, why composable, built right, the part nobody can copy,
  why Revio (eight), what you're choosing between, pricing, four promises, FAQ, closing, footer.
- ☐ **I2** Product pages ×4 — ~95% keep; apply only the listed changes. "Live today" → **"Live in
  production"** on every eyebrow.
- ☐ **I3** About — full reframe. Kill the underdog framing; lead with strength.
- ☐ **I4** Security — keep 90%; fix "What we don't have yet".
- ☐ **I5** Compare — category-based, no competitor names.
- ☐ **I6** How it works.
- ☐ **I7** Meta / SEO / social.
- ☐ **I8** Every "why us" claim ends in a labelled **Proof —** line.
- ☐ **I9** Company block — **post code 7002**, and the legal name in both scripts (A1).

### ⚠️ Copy that makes a promise the software does not keep
- ☐ **I10** *"Free until your first booking syncs."* **Decision: BUILD it.** Record the first
  successful booking sync per property → set `billingStartDate` → suppress invoicing before it. A
  property that never gets a first booking stays free, which is correct. **Blocks I1** — the promise
  must not be published while billing ignores it. Interim line if the page ships first: *"Free setup
  — we don't start billing until you're live."*
- ☑ *"Per property, excluding VAT"* — confirms the VAT-exclusive reading already implemented.
- ☑ Pricing table matches `pricing.ts` exactly: €0/€50/€150/€300, €49/€59/€69, 10%/20%, 2%.
