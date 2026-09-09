# App: PMS — Operations (`@revio/pms`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **V1 COMPLETE — all 5 phases built,
> tested, live (2026-07-05).** **Canonical spec: `docs/PMS-REFERENCE.md`** (founder-confirmed V1 scope).
> **LIVE: https://pms.reviosoft.app** (port 3003, cookie `revio_pms_session`, `hasPms`
> gate). **Phases 1-5 DONE — RevioPMS V1 COMPLETE, live** (Units & Housekeeping · Front Desk check-in/out/move/walk-in ·
> Folio & Billing with labels-only payments + a check-out balance gate · Minibar/POS catalog + tap-to-post
> to the folio · Maintenance task board + manual Close Day night-audit). Next: Channex production cert
> (process), then RLS prod-enforcement flip (LAST, covers all products). Gotchas: the RLS proxy `lib/db.ts` forwards `prisma.<model>.<op>`
> ONLY (no `$transaction`); the preview harness drops the session cookie on server-action POSTs (verify via
> minted-cookie curl — GET link-clicks keep it); after a migration RESTART `next dev` + `rm -rf .next` so it
> loads the regenerated Prisma client; re-mint the session cookie after any re-seed (User ids change).

> **Any screen you build here is held to `docs/UI-STANDARD.md`** — borrow the familiar shape, say it before it is read, one component per concept, and look at the rendered page.

> **V2 overhaul in flight (founder spec 2026-07-09: `docs/specs/PMS-GUIDE-V1.md` — read it before
> changing any PMS screen; Keep sections are binding).** Headlines: nav regroups into Front Office /
> Rooms & Housekeeping / Setup / End of Day; new screens — unified **Reservation view**, operational
> **Guests** profile, **User Management**, **Configuration**; housekeeping gets in-progress + smart
> routing + the one-room-in-progress rule + inspection gate + a scoped mobile role; **every folio
> charge must go through ONE charge-posting service** (outlet + tax tags — the required architecture,
> §1.7); split folios; deposits are **liabilities** (held default vs applied per type); a
> jurisdiction-agnostic **Invoicing module** (gapless series, tax-per-rate); three integration
> boundaries — payment gateway (mock + Stripe test-mode), external POS (via the posting service),
> fiscalization/e-invoicing (Bulgaria N-18 = go-live blocker for real properties). Task phases
> D (operations) + E (money) + F (assignment/seams) in the tracker.

> **🔜 Page-by-Page Refinement Round 1 intake (founder doc 2026-07-20: `docs/specs/PMS-REFINEMENT-R1.md`
> — read it before changing any PMS screen; NOT yet built, plan pending sign-off).** Additive refinement
> on the shipped V2 (D/E/F), judging every screen by *who's on it and what decision they make here*.
> Headlines by screen: **Front Desk** → FD-metric KPI row, two co-equal action columns + collapsible
> in-house, **"Needs attention" exception strip**, overdue-checkout states, **extend-checkout** (same-day
> only — NOT a stay extension), active room-ready↔arrival prioritize link; **Reservation view** → the
> action hub (check out / extend / move / post / folio), drop dev scaffolding; **Guests** → graceful
> empty-state degrade, **n≥2 preference guard**, **guest identity/merge (foundational)**, blacklist +
> GDPR consent, action-paired profile; **Folios** → **Open/History split**, closed-folio-as-statement,
> nameable/removable splits, **mandatory-deposit check-in gate**, checkout-readiness signal, document
> layer (bill/invoice/credit-note via the invoicing module); **Extras & Charges** (rename) → pick-a-folio
> reframe, void+quantity, folio-routing on splits, real add/edit/remove catalog w/ tax category;
> **Housekeeping** → **role-scoped views** (housekeeper list / supervisor board / FD readiness),
> **Dirty→In progress→Awaiting inspection→Ready** pipeline, reason-on-each-room, per-cleaner assignment,
> **clock-in/active workforce**, manager-only event-stream analytics; **Rooms** → structured beds + max
> occupancy (type-vs-physical boundary), **floor/zone as a first-class object** (warn-and-steer), self-
> populating lifecycle timeline, bulk edit, delete guard; **Maintenance** → reuse HK pattern (crew view +
> clock-in + analytics), severity/revenue priority, **On-hold-awaiting-parts** lifecycle, **OOO↔revenue
> loop** (complete → prompt back-on-sale), fix-photo, cost note; **Configuration** → §9 is the expansion
> target (E7 shipped a base) — grouped sections + search + deep-links, owns times/late-checkout default/
> deposit types+mandatory flag/inspection mode/catalog/roles matrix; **Staff & Access Management**
> (rename) → live workforce roster + clock-in (incl. delegated) + user CRUD + per-user security (login/
> device history, restrict/suspend). **Cross-cutting invariants:** one shared identity; readiness-before-
> irreversible; every create needs a lifecycle-gated inverse; role shapes the view (no escalation);
> set-default-general/override-specific; degrade empty states; no dev scaffolding in shipped UI; EU
> worker-data/GDPR caution on all clock-in/analytics. **⚠ Two pending founder items:** the **§11 Close
> Day** section ("will add later today") and round scope/sequence sign-off. Task phase **H** to be created
> on sign-off.
>
> **⏳ IN BUILD — phase J (RevioPMS R1). J0 data foundations DONE + committed (2026-07-21, not yet pushed).**
> The three build-first primitives the screens consume: **guest identity/merge** (`Guest.mergedIntoId` +
> `lib/guest-identity.ts` dup-detection + `lib/actions-guests.ts` `mergeGuests`), the **ops event stream**
> (`OpsEvent` model + `lib/events.ts` `recordOpsEvent`/`getUnitTimeline`/`getHousekeepingPerformance`), and
> **clock-in/workforce** (`StaffShift` model + `lib/workforce.ts` + `lib/actions-workforce.ts` self+delegated
> clock-in, each appending an OpsEvent). Migration `20260721182000_pms_r1_foundations` (additive). **Remaining
> in J:** §9 Configuration expansion + the ten screens J1–J9 (wire these primitives into UI), J10 Close Day
> (awaits §11), J11 verify+deploy. Wire `recordOpsEvent` into HK/maintenance status changes when building J6/J8.

## The folio screen is ordered by the job, not by the catalogue (2026-09-09)

It ran: post a charge → take a payment → stay extras → invoicing → deposits → **check out, at line 560
of 713**. A receptionist with a guest in front of them scrolled past four sections they did not need
to reach the button they opened the page for.

Now: **take the money, then send them on their way.** Everything else folds away below.

⚠️ **Tabs were proposed for this and rejected, correctly.** The founder's objection: *"won't it be
harder for receptionists, won't they get more confused?"* At a front desk, yes — and the reasons are
specific to this screen rather than to tabs in general:

- **You do not know in advance which tab you need.** "Half on the card, half in cash", or "can I have
  it on the company", arrives *after* the page is open.
- **A tab you never open is a feature you never learn exists.** Somebody can work here for months
  without discovering deposits.
- **It breaks muscle memory**, and this is done twenty times a day with somebody waiting.

Tabs suit the operator's client page, where one person reads at leisure. This is a queue. `Foldaway`
is what replaced the idea: `<details>`/`<summary>`, everything still in one scroll, nothing behind a
label you must know to click — and **the state on the line**, so "are there deposits?" is answered by
"None held" without a click. It stays in the document while shut, so find-in-page still reaches it.

Two things carry real weight and neither is decoration: the running total is **sticky** at
`top-[60px]` (clearing the topbar) because the balance is what a receptionist checks against what the
guest is handing over; and `tone="attention"` colours a state that is a **job** — money held must be
applied or refunded before the guest walks out — differently from one that is merely true. Caught by
looking: "€50 held — apply or refund before checkout" was the same grey as "No invoice issued yet".

Sold standalone as an operations layer, even over a foreign reservation system. Reads/writes inventory
**only** through `@revio/core` — never ad-hoc queries against inventory tables.

## What it owns (vs CM/CRS)
- **CM** = ARI syncing · **CRS** = the reservation record + metrics · **PMS** = running the property today.
- The PMS realizes the CRS lifecycle states marked *"future — needs PMS connection"* (Checked-in/out).

## The one new concept: physical **Units**
CM/CRS manage inventory as **counts per room type**; the PMS is the first product that cares **which**
room (to clean/key/bill it). It adds a `Unit` (room, or bed for hostels — `unitKind`), and hangs
housekeeping, room assignment, and folios off it **without changing the availability math**. Marking a
Unit **Out-of-Order** writes a CRS `RoomInventoryPeriod` → the shared **waterfall** → one room off sale on
every OTA on the next CM push. That OOO write is the ONE thing that leaves the PMS.

## V1 scope (see `docs/PMS-REFERENCE.md` for the full spec + settled §0 decisions)
- **Front desk** — arrivals/departures/in-house, check-in (room assignment) / check-out / walk-in / room move.
- **Housekeeping** — Clean/Dirty/Inspected/OOO per Unit, task board, supervisor check. **Mobile web (PWA)**
  for non-reception roles — not native apps.
- **Folio & billing** — one folio per stay; post/void charges; **payments = labels + amounts only** (no
  card data, no gateway — matches CRS + the platform card-data rule); balance; settle-at-check-out gate.
- **Minibar / consumables** → charges posted to the folio (mobile quick-post).
- **Maintenance / tasks** (basic) → a unit task may set the Unit OOO.
- **Day close** = a **manual** "Close Day" action (post night's room charge, flag no-shows, roll business
  date in property TZ). Locks/keys = label/placeholder only (hardware integration is future).

## Hotels vs hostels
Hotels/apartments sell **rooms**; hostels sell **beds**. The `Unit` abstraction (`unitKind: room | bed`)
covers both — hostels are a later config flag, **built rooms-first** in V1, not a bolt-on rewrite.

## Platform fit
Fourth Next app (port **3003**, cookie `revio_pms_session`), same shell/auth/session choke point + Railway
service pattern; `hasPms` entitlement gates it (Operator toggle). Adds only **6 tables** (Unit, UnitStatus,
RoomAssignment, Folio/FolioLine, PosItem, tasks) — all `tenantId` + `tenant_isolation` RLS. Metrics stay in
the CRS `@revio/core` formula sheet; per-OTA config stays in the CM. **RLS prod-enforcement stays LAST**
(one pass covers every product's tables).
