# August 2026 specs — implementation tracker

Every item from the three documents in `docs/specs/inbox/`, enumerated so none is lost. Sections
reference the source docs; open them for the full reasoning rather than duplicating it here.

**Source (all in `docs/specs/inbox/`):**
`RevioCRS-Live-Refinement` · `RevioLink-OBP-Implementation` · `RevioPMS-Live-Refinement` ·
`RevioPMS-OBP-Implementation` · `Revio Website changes`

Status: ☐ open · ◐ in progress · ☑ done

---

## A. Company identity — bilingual (asked directly, 2026-08-24)

- ☑ **A1** Legal name stored in **both Cyrillic and Latin**; the invoice picks by the customer's
  country — a Bulgarian buyer gets `Уебър БГ ЕООД`, everyone else `WEBER BG EOOD`. Both are
  legitimate; the document should not look like two different companies.
- ☑ **A2** Same for the registered address, or an invoice reads half in one script and half in the other.
- ☑ **A3** Post code is **7002** (the website draft says 7000 — the draft is wrong).

## B. Channex sync

- ☑ **B0** A rate plan maps **per room type**. Channex ties a plan to one room type; we model plans at
  property level, so a hotel with 3 room types and 1 plan pushed all three at the same Channex rate
  plan — last write wins, two room types silently mispriced on every OTA, Sync Center green. Found by
  checking a real property's shape rather than the certification property's, which was hand-built
  2×4 and is the one arrangement where this cannot go wrong.
- ☑ **B4** `channex:onboard` — one command from signed hotel to connected: key stored encrypted,
  Channex property, room types and rate plans built from our data, every mapping written, with
  `--dry-run` and an undo. Refuses to run against a demo tenant.
- ☑ **B1** Parse `meta.warnings` — Channex rejects values inside an HTTP 200. Verified live, fixed,
  deployed. *(CRS §6.7a / CM L7)*
- ☑ **B2** Rate value convention: integer minor units everywhere, never a decimal string. *(§6.7a)*
- ☑ **B3** Reject a rate ≤ 0 before sending rather than learning it from a warning. *(§6.7a)*

---

## C. RevioCRS — Dashboard *(§1)*

- ☑ **C1** *(§1.2)* "Occupancy & revenue by day" renders **nothing** on load. Default to a 30-day
  window; never blank. **Dual axis** — occupancy as a line (left, %), revenue as bars (right, €).
  Both on by default; legend click mutes either. Not a toggle: the gap between them is the insight.
- ☑ **C2** *(§1.3)* Source mix is bars-as-rows. Make it a composition visual (donut or stacked) over
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
- ☑ **E2** *(§3.3)* **Both halves.** The availability search's two native date inputs became one
  two-month range picker (`@revio/ui/stay-range-field`) — extracted from the booking engine, which
  already had one, because a second caller appeared. It still submits `from`/`to`, so the search
  stays a GET form and therefore a shareable URL. And the **global** half: every remaining native
  date input across all four staff apps (23 of them, 13 files) is now `@revio/ui/date-field`, which
  calls `showPicker()` on click — the field opens when you click the field, not only the glyph. The
  calendar helpers moved to `@revio/core/stays/calendar` (13 tests); `apps/booking/lib/dates`
  re-exports them so one implementation serves both.
- ☑ **E3** *(§3.2)* Known-booking **bypass** — guest-first entry, converging on the same
  hold → details → confirm tail. Search-first stays the default.
- ☑ **E4** *(§3.2)* Show **rate plans at the shop step**, not only after hold — agents upsell on rate choice.
- ☑ **E5** *(§3.1)* **Verified — a hold cannot exist without a TTL.** `Hold.expiresAt` is
  `DateTime`, **not nullable**, so the database refuses one. Every production path goes through
  `claimHold`, whose input type requires it (CRS: `holdTtlMinutes ?? 30`; RevioDirect:
  `HOLD_MINUTES`). The only other `hold.create` in the repo is in `claim-verify.ts`, which
  deliberately reproduces the old broken shape to prove the race still exists.
  **The property that actually matters:** all ten availability reads filter `expiresAt > now()`, so
  an expired hold stops blocking inventory the instant it lapses. `releaseExpiredHolds` is cleanup
  and bookkeeping — it is *not* what makes the room sellable again, so a late or failed sweep cannot
  cost a booking.

## F. RevioCRS — Guests *(§4)*

- ☑ **F1** *(§4.2)* **"Book again" on the profile** — the concrete home for E3. Highest-leverage add.
- ☑ **F2** *(§4.3)* Guest merge — CRS half built, and the rules **extracted to `@revio/core`**
  (`guests/merge.ts`, 24 tests): `matchDuplicates` · `planMerge` · `suggestWinner`. Extracted because
  a second caller appeared, which fixed four things in the PMS version: the merge was **not
  transactional**, duplicate detection **read every guest in the property** (twice per profile), the
  contact back-fill was a second hand-written copy of `hydrateGuestContact`, and it matched **two OTA
  relay addresses as the same person**. Phone matching now compares trailing digits, so `+359…`,
  `00359…` and `0…` are one number rather than three.
- ☑ **F3** *(§4.4)* **Low-sample labels.** "Average stay 3.0 nights" from ONE stay claims a pattern
  that does not exist. Below a threshold say "Last stay", or annotate the sample.
- ☑ **F4** *(§4.5)* Contact hydration — `hydrateGuestContact` in `@revio/core`, 16 tests.
  Enrich-empty / never-overwrite / tag-OTA, as decided. **The spec said "from the most recent linked
  reservation", but `Reservation` carries no contact fields** — email and phone live only on `Guest`,
  so the real source is the booking being made. Wired into `public-engine.ts`, which was matching a
  returning guest by email and discarding everything else they typed: a guest could enter their phone
  on two stays and still have a blank phone on file. `Guest.emailIsOtaAlias` is new (migration
  `20260826140000`) and surfaced on the CRS guest profile — an untagged relay address gets emailed
  after it has stopped forwarding.
  **Enrich empty · never overwrite · tag OTA-sourced as an alias** — OTA relay addresses are fine for
  messaging and are not ground truth. Powers the F1 prefill.
- ☑ **F5** *(§4.6)* **A standing decision, verified true.** No charts on a guest profile — the
  Analytics visual mandate does not reach here. One guest's history is a handful of rows, and a bar
  chart of four bookings dresses a small number as an insight. Checked: the profile renders no chart
  component. The item stays on the record so nobody adds one later.

## G. RevioCRS — Inventory Calendar *(§5)*

- ☑ **G1** *(§5.2)* Restrictions row renders a bare "." — **badges** instead (MIN 2, CTA, CTD, closed).
  Biggest at-a-glance weakness.
- ☑ **G2** *(§5.2)* Grade the Remaining row by pressure, reusing D10's relative threshold. Subtle
  shading only — it must stay editable.
- ☑ **G3** *(§5.3)* **Make the derived cascade explicit** — one line: *"Derived plans follow Standard
  — change it and they recompute."* One line, and it is the difference between the feature feeling
  clever and feeling risky. **Do first.**
- ☑ **G4** *(§5.3)* **Tab the bulk modal** — Rates | Availability | Restrictions.
- ☑ **G5** *(§5.3)* Co-locate rate-plan selection with the Price control.
- ☑ **G6** *(§5.3)* Unit-aware Value field (€/%) with an inline result, and a Preview that spells out
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

- ☑ **H1** Data model — **done, on branch `obp/h1-data-model`.** Rate is now
  `(room type, rate plan, date, occupancy)`. **Per-room is the one-row special case at max
  occupancy**, so both models share one schema and switching is a row expand/collapse, not a fork.
  `PropertyDefaults` gains the §6.2 config; `RoomType.defaultOccupancy`; `RatePlan.pricingModel` ·
  `primaryOccupancy` · `rateMode` · children/infant fees. **`OccupancyAdjustment` was renamed to
  `RatePlanOccupancy`** — it was a price *delta* read by nothing, and the spec needs a first-class
  row with `isPrimary` and its own rate; the old delta columns survive as the derivation rule.
  `packages/core/src/rates/occupancy-options.ts` holds validation + resolution + model switching,
  **31 tests**. The compound key change made the compiler enumerate all **10** rate-writing sites
  across CRS and Link — each resolves occupancy through `occupancyKeysFor`, hoisted out of every
  bulk loop. Migration proven: full chain applies clean, rename keeps its RLS policy, backfill sets
  existing rows to the room's max.
- ◐ **H2** Settings — **property toggle shipped.** Preview and apply share
  `planPricingModelSwitch`, so the confirmation is computed by the code that performs it; one
  `withTenantTransaction`, because half a switch leaves some plans per-person and some per-room with
  nothing recording which. Seed mode and the safety sentence ("your current price stays on the
  primary occupancy") are on the screen. Per-plan override + room `defaultOccupancy` exist as gated
  actions; their Rooms & Rates surfaces land with H4/H5.
- ☑ **H3** Channex sync — **done.** Mapper (`channex-occupancy.ts`, 19 tests): the two rate shapes
  (`rate` scalar vs a `rates[]` array in ONE object), `options[]`, `derived_option`, `rate_mode`
  incl. **cascade**, and degradation to the primary for single-rate channels — **wired into
  `sync.ts`**, which now resolves through the shared resolver. The daily
  `rates[]` push, batching, warnings. *(§6.7 / §6.7a / L7)*
- ◐ **H4** Bulk-edit occupancy matrix — **planner done** (`bulk-occupancy.ts`, 16 tests): the
  matrix rows, both entry modes (manual per occupancy · primary-plus-offsets), and the mixed-cap
  rule. ⚠️ **That rule is the OPPOSITE of `planCeiling` on purpose** — render to the HIGHEST cap and
  skip per room, because this edits a matrix across rooms rather than defining one plan. Offsets
  compound **per step from the primary**, which is what "each extra guest" means. The panel UI
  remains.
- ☑ **H5** Calendar per-occupancy display — **shipped.** The cell keeps ONE number (the primary,
  resolved by `resolveRate` so it cannot disagree with the quote or the push) plus a badge showing
  how many guest counts are priced; the rest are a click away. Deliberately **not** N permanent rows
  — a 4-guest room with three plans would turn 12 rows into 48 and destroy the at-a-glance scan the
  screen exists for. A per-room property renders exactly as before.
- ☑ **H6** Rate resolution — **done.** `resolveRate` (`resolve-rate.ts`, 20 tests): one function for
  the booking engine, CRS, Channex push and PMS folio, so the four cannot disagree. Both derivation
  axes in the right order — cascade takes the parent's price **at this occupancy**, not the parent's
  primary re-offset, which is a different number. **RevioDirect and the Channex push both call it**;
  CRS agent quoting follows with the H4/H5 screens. `obp-parity.test.ts` proves quote == push by
  computing both, not by inspection. *(§6.6)*
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

## J. RevioPMS Round 2 — **already shipped in earlier sessions**

Audited against the code 2026-08-25. The two PMS documents arrived later than the others; almost
everything in them was already built, which is worth recording so it is not rebuilt.

- ☑ **§1.3** Checkout is one atomic transaction — `withTenantTransaction`, four call sites.
- ☑ **§1.3-B** Queries read status, not proxies — "open" means `status = open`; "overstayed" requires
  not-checked-out.
- ☑ **§1.4** `Closed — outstanding` as a managed state: `Folio.outcome` / `outcomeNote` / `outcomeAt`
  / `outcomeById`, and all four resolutions (`reopen`, `paid_offsystem`, `receivable`, `written_off`),
  manager-gated and logged.
- ☑ **§1.5** Receivables view — a third tab beside Open and History, its count on the label.
- ☑ **§1.6** Empty split folios removable.
- ☑ **§2** Reservations calendar with the tape grid, drag-to-move and the §2.6 click-to-manage modal.
- ☑ **§3** Close Day auto-close — running on the cron, 6/6 green.

### Still open in the PMS docs
- ☑ **J1** *(§1.4)* **Verified, and it passed by absence — which is not the same as passing.**
  A write-off posts no folio line at all (only `Folio.outcome`), so nothing that sums payments can
  ever count it as income: the conflation the spec feared does not exist. But `written_off` and
  `paid_offsystem` were reported **nowhere** — one label on one folio, no total anywhere — so an
  owner could not answer "how much did we write off last month" without opening folios one at a
  time. Closed with `folio-outcomes.ts` (10 tests) and a summary on Folios → History: collected,
  owed and lost as **three numbers that are never added together**, and every row shown at zero
  because an absent row reads as "not measured".
- ☐ **J2** *(§4 / P1–P15)* OBP on the PMS side. Depends on the shared model (H1). Sequenced last.

## K. OBP on the PMS *(RevioPMS-OBP-Implementation, P1–P15)*

The PMS **consumes** the model; it never owns one. Folded into H, built after H1–H3.

- ☐ **K1** *(P2)* Occupancy as a first-class field on every reservation; captured inbound and on
  walk-ins. "Doesn't fit" guard applies.
- ☐ **K2** *(P3)* One resolver — `resolve_rate(room type, plan, date, occupancy)`. Per-room is the
  single max-occupancy row, so per-room properties behave exactly as today.
- ☐ **K3** *(P4)* ⚠️ **The crux.** A **rate snapshot per night** on the reservation. The PMS bills the
  snapshot and never silently re-resolves — a guest confirmed at €120 must not be billed €132 because
  the occupancy table moved afterwards. The CRS quotes live; the PMS bills what was quoted.
- ☐ **K4** *(P6–P8)* Re-resolve **only** on a real change — mid-stay occupancy change, cross-type
  move, check-in confirmation — each atomic with the folio, on the existing state machine.
- ☐ **K5** *(P9)* Night audit posts the snapshot nightly rate. Auto-close inherits it, no separate path.
- ☐ **K6** *(P10)* Folio line shows the occupancy it was priced at.
- ☐ **K7** *(P5 / §4.5)* Calendar gets an occupancy badge (`2p`) and **no rate strip** — the PMS
  calendar stays rate-free by design, deliberately unlike the CRS one.
- ☐ **K8** *(P11)* Children/infants as separate folio lines. After adult OBP.

---

## I. Website *(Revio Website changes)*

Full copy replacement, in page order. Repo: `revio-websites`.

- ☑ **I1** Homepage — hero, three products, why composable, built right, the part nobody can copy,
  why Revio (eight), what you're choosing between, pricing, four promises, FAQ, closing, footer.
- ☑ **I2** Product pages ×4 — ~95% keep; apply only the listed changes. "Live today" → **"Live in
  production"** on every eyebrow.
- ☑ **I3** About — hero reframed to access + accountability; the deficit column became four
  advantages with the same trade-offs kept in one honest paragraph beneath. "Five consecutive high
  seasons" deleted outright.
- ☑ **I4** Security — all four cards lead with the reason, not scarcity. **The 2FA card was wrong
  in our own disfavour**: TOTP is live on the operator console (enrolment, challenge, recovery
  codes, replay refused). Copy now says so, and names hotel-account 2FA as what is actually next.
- ☑ **I5** Compare — `/compare` compares four approaches; `config/approaches.ts`. The three
  `/vs/[brand]` pages 301 to it rather than 404.
- ☑ **I6** How it works — kept the X/✓ migration contrast, condensed the two homepage repeats to a
  callback and a link, added the `#zero-migration` / `#promises` anchors they point at.
- ☑ **I7** Meta — homepage description per spec. OG/Twitter cards were already complete.
- ☑ **I8** All eight `DIFFERENTIATORS` carry a proof line. One was **overclaiming** — "a real
  Bulgarian fiscalization path" — and is now ЗДДС чл. 114 numbering, which is true and checkable.
- ☑ **I9** Company block — **post code 7002**, and the legal name in both scripts (A1).

### ⚠️ Copy that makes a promise the software does not keep
- ☑ **I10** *"Free until your first booking syncs."* **Built.** `Tenant.billingStartsAt`, null until
  earned. **Two paths, because the refund policy has two**: with channel management, the first synced
  booking; without it, setup completion — the first version had only the first path and would have
  left every CRS-only and PMS-only client free forever. The rule lives once in `markBillable`;
  `isBillablePeriod` is shared with the invoice generator so the two halves cannot drift. The copy
  said "the first successful push", which is us sending rates OUT and proves nothing — corrected.
  **No longer blocks I1.**
- ☑ *"Per property, excluding VAT"* — confirms the VAT-exclusive reading already implemented.
- ☑ Pricing table matches `pricing.ts` exactly: €0/€50/€150/€300, €49/€59/€69, 10%/20%, 2%.
