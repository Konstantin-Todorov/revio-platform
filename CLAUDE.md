# Revio — Hotel Software Platform

Revio is a **composable line of hotel software products** that share one core. Each product is
sold and used independently, but they run on a single shared inventory engine so a hotel can buy
one today and add the others later with zero migration.

This file is the **big picture**. Every folder below has its own `CLAUDE.md` that narrows scope to
that module. When you work inside a module, Claude Code loads **this file + that module's file**, so
each module "knows it belongs to something bigger" while keeping its own boundaries. Read the local
`CLAUDE.md` before changing anything in a module.

## The products

The **platform brand is Revio**; each product has a market name. Engineering paths stay descriptive
(`@revio/core`, `apps/channel-manager`) — product names live in the UI and docs, not deep code paths.

| App (folder) | Product name | What it does | Sold to |
| --- | --- | --- | --- |
| `apps/channel-manager` | **RevioLink** | Push availability/rates/restrictions to OTAs, pull bookings back, keep them in sync. **First product, the demo, the priority sale.** | A hotel that already has a PMS |
| `apps/reservation` | **RevioCRS** | Reservations, rates & restrictions, guests, analytics. The system of record for every booking, from any source. | A small property with no OTA needs |
| `apps/pms` | **RevioPMS** | Front desk, housekeeping, folios & invoicing, outlets, maintenance. | An operations layer over a foreign system |
| `apps/booking` | **RevioDirect** | The hotel's **own** booking page — the only public, unauthenticated surface. Configured from RevioCRS, not sold on its own. | An existing customer's guests |
| `apps/operator` | **Revio Operator** | **Our** admin console: all hotels, billing, integration keys, entitlements, sync health. | Internal (the SaaS operator) |

## The one rule that governs everything

**There is a single source of truth for availability**, and it lives in `packages/core`. The whole
reason the Channel Manager exists is to stop two guests booking the same room. If products kept their
own copies of inventory, we would recreate that exact double-booking problem *inside our own
platform*. So:

- **One database. One inventory core.** Every app reads and writes inventory **only** through
  `@revio/core` — never with their own ad-hoc queries against inventory tables.
- Apps **never import another app's internals.** Apps depend on `packages/*`, not on each other.
- "Sold separately" is a **licensing** decision, not a code-separation decision — see Entitlements.

## How products are sold separately: Entitlements

A hotel account has **entitlements** (which modules it bought). The same login shows only the apps the
hotel is entitled to. Buying another product later just flips an entitlement — the data is already
shared. This is our edge over all-in-one suites (Mews/Cloudbeds) and pure channel managers
(SiteMinder): land with CM, expand into CRS/PMS without re-onboarding.

Three tenant entitlements exist — `hasChannelManager` · `hasReservation` · `hasPms`. **RevioDirect is
deliberately not one of them:** it is switched on per *property* (`Property.bookingEngineEnabled`),
because a chain can sell one hotel direct and not another, and because the booking page is a surface
of the hotel's own CRS rather than a product with its own login.

## Multi-tenancy & isolation

- Shared Postgres with **Row-Level Security**: every tenant-owned row carries `tenant_id`; the DB
  physically refuses to return another tenant's rows even if app code has a bug.
- Two perimeters: **Operator** (sees all hotels — operator console only) vs **Hotel** (sees only its
  own data and only purchased modules). Operator business data (contracts, billing, OTA tokens) lives
  in an admin schema the hotel can never read.
- Integration tokens are encrypted at rest and never exposed to a hotel.

## Connectivity is behind an adapter — demo runs on a mock

Every channel (Booking.com, Expedia, …) is reached through one `ChannelAdapter` interface in
`packages/core`. A `MockChannelAdapter` implements the same interface, so the **entire ARI loop runs
live on seeded demo data** before we hold any real OTA certification. When real OTA / Channex access
arrives, we swap the adapter — nothing else changes. **Build and demo against the mock first.**

## The ARI loop (the product, in one line)

`edit → derive → push → book → pull → re-push`. Everything in the Channel Manager either configures
this loop (Rooms & Rates, Restrictions, Channels, Mapping) or monitors it (Dashboard, Sync Center,
Error Center, Audit Log). See `apps/channel-manager/CLAUDE.md` and `docs/`.

## Tech stack

- **TypeScript end-to-end.** Shared domain types live in `packages/core` and are imported by every app.
- **Next.js (App Router)** for the apps; for the demo the API lives in Next route handlers calling
  `@revio/core` (modular monolith). Extractable to a standalone service later without rewriting domain logic.
- **Postgres + Prisma** (RLS enabled). **Redis + BullMQ** for the sync queue (in-process for the demo,
  externalized later).
- **Tailwind** + design tokens in `packages/ui` (derived from the Atlas direction — see `design/`).
- Package scope: `@revio/*`. Node ≥ 20, pnpm workspaces.

## Layout

```
apps/        channel-manager · reservation · pms · operator · booking   (each with its own CLAUDE.md)
packages/    core (domain + inventory + rates + restrictions + adapters) · db · ui (tokens)
             connectivity (Channex + push/pull orchestration) · booking (public guest domain)
             email (templates → transport) · payments (the only card path) · storage (uploaded media)
docs/        spec & architecture (questionnaire answers, CM developer reference, architecture analysis)
design/      Atlas/Haven/Pulse handoff prototypes + Revio brand
```

The five non-`core` packages all exist for the same reason: **two apps needed the same thing, and an
app may never import another app's internals.** Each was extracted at the moment a second caller
appeared — never speculatively.

## Conventions

- Money is integer **minor units** (cents) + an ISO currency code — never floats.
- Dates for inventory are calendar dates (`YYYY-MM-DD`), timezone-resolved at the property.
- Domain logic is **pure and tested** in `packages/core`; apps stay thin (UI + wiring).
- Don't widen a product's scope past what its `CLAUDE.md` says is in V1.

## Deployment

- **Repo:** https://github.com/Konstantin-Todorov/revio-platform (branch `main`).
- **Live — RevioLink (CM):** https://channel-manager-production-59bb.up.railway.app
- **Live — Operator Console:** https://operator-production-5eed.up.railway.app
- **Live — RevioCRS:** https://reservation-production-f8c5.up.railway.app
- **Live — RevioPMS:** https://pms-production-a64b.up.railway.app
- **Live — RevioDirect:** https://booking-production-8e50.up.railway.app/&lt;slug&gt; — e.g.
  `/hotel-sofia`. **All five apps are deployed.** The object-storage bucket is live and shared with
  `reservation` (which writes photos; this one reads them), so room photographs survive a container
  restart. Still on the Railway subdomain: `book.revio.app` is a DNS change, not a build change, and
  the CRS's `BOOKING_ENGINE_ORIGIN` is the single place that has to follow it.
- **Auto-deploy:** every service tracks `main`, so one `git push` builds and deploys all five.
- **Railway project:** `revio-platform` — one Postgres shared by all services; each app is its own web
  service. **Each service defines its own build/start via Railway config** (NOT a root `railway.json` —
  that applied to every service and was removed): build = Nixpacks `pnpm install → db:generate → next
  build` for its own `--filter`; start = `prisma migrate deploy` → `next start` on `$PORT`.
- **Auto-deploy:** both services track `main` — **every `git push` builds and deploys both
  automatically.** Migrations run on each deploy; the DB is never reset.
- **Adding an app** (CRS/PMS): `railway add --service <name>`, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
  patch its build/start to its own `--filter`, set source repo. See `DEPLOY.md`.
- Local: `pnpm --filter @revio/<app> dev`. Seed/inspect the remote DB from this machine via
  Postgres's `DATABASE_PUBLIC_URL` (the internal `DATABASE_URL` isn't reachable off-Railway).

## Auth (live)

Self-hosted email + password (bcryptjs) + signed JWT session cookies (jose). `getSession()` /
`getOperatorSession()` now resolve **real** identity; `middleware.ts` gates by cookie; `/login` lives in
each app outside the `(protected)` route group. CM cookie `revio_session`, operator `revio_op_session`,
CRS `revio_crs_session`.
`AUTH_SECRET` is set per Railway service. **Demo logins (password `revio1234`):** RevioLink + RevioCRS →
`admin@hotelsofia.demo` or `owner@blacksea.demo`; Operator → `operator@revio.app`.

**RevioDirect has no auth and no session** — it is the public surface, so it has no tenant context
until a slug resolves. That inversion is why it gets its own app and its own rules; see
`apps/booking/CLAUDE.md` before touching anything in it.

## Status

RevioLink + Operator Console are **built, tested, live, and behind login** with GitHub auto-deploy.
**RevioCRS V1 is COMPLETE — all 5 phases shipped 2026-07-03**: availability waterfall + metrics formula
sheet + ChannelManagerConnector in `@revio/core` (CM pushes subtract OOO/closures/holds and apply
property-default restrictions), full CRS data model + RLS, `apps/reservation` (port 3002) with Dashboard
(metrics/Action Center/Forecast) / Reservations (Availability Search → instant Hold → confirm,
modify/cancel/no-show) / Guests / Inventory Calendar / Rates & Restrictions (4-level priority,
source-scoped rules) / Reports+CSV / Global Search / Distribution / Settings (permissions matrix,
taxes & fees), pickup-snapshot + hold-expiry jobs (see `apps/reservation/CLAUDE.md`).
Operator onboards clients; **clients self-manage staff (roles) + properties** from RevioLink Settings.
Both apps now have a **responsive (mobile) shell**; **RLS is ENFORCED IN PRODUCTION since 2026-08-05** —
all five services connect as the restricted `revio_app` role (no superuser, no `BYPASSRLS`, no DDL), so
tenant isolation is a database guarantee rather than an application convention; and the **Channex adapter
is built + live-verified against the sandbox** (`@revio/connectivity`,
not yet wired into the app). **RevioPMS V1 is COMPLETE — all 5 phases built, tested, live** (founder-confirmed
spec `docs/PMS-REFERENCE.md`): `apps/pms` (port 3003, cookie `revio_pms_session`, `hasPms` gate) at
https://pms-production-a64b.up.railway.app — the physical **Unit** model + housekeeping board (Phase 1),
Front Desk check-in/out/room-move/walk-in (Phase 2), Folio & Billing with labels-only payments + a
check-out balance gate (Phase 3), Minibar/POS catalog + tap-to-post (Phase 4), Maintenance + manual
Close Day night-audit (Phase 5). The one cross-product write: a Unit going out-of-order (from housekeeping
or maintenance) → a `RoomInventoryPeriod` → the shared availability waterfall. **All four products
(RevioLink · Operator · RevioCRS · RevioPMS) are now built and live.** **Cross-product Channex auto-push
is live**: the push/pull orchestration moved into `@revio/connectivity` (`sync.ts`, parameterized by a
tenant-scoped Prisma proxy), so a CRS booking or a PMS walk-in/OOO **immediately** pushes updated ARI to
Channex (verified on prod: a PMS OOO and a CRS save each produced a Channex task `success:true`). The
**Operator console is complete** (Overview · Clients · Connectivity · Platform Health · Settings · Billing
— billing UI + `Invoice` model with operator-only RLS, **payments mocked**). **Entitlement gating verified**
across one/some/all product combos.

**→ ✅ OPERATOR ROUND 2 (phase L) — COMPLETE, L1–L6 SHIPPED + LIVE 2026-08-05.** The console stopped counting and
started saying what to do. Three pure, tested modules in `apps/operator/lib/` (29 tests):
`clientAttention` derives what needs a call — stalled onboarding, a product billed for and never
switched on, unpaid invoices, sync failures, a client that used to book and stopped — with severity
meaning *how soon*, not how bad; `clientOpportunities` carries **two numbers per opportunity and the
UI leads with theirs** (`clientValueMinor` = worth to the hotel, `monthlyUpliftMinor` = our MRR),
`null` rather than a flattering guess when their side is not computable; `tierForRooms`/`tierDrift`
finally implement the **room-count pricing tiers** stated since the first architecture note and never
computed, reporting **over-billing as plainly as under-billing**. The RevioDirect pitch is priced by
**`channelEconomics` — the same function behind the hotel's own Cost of distribution screen**, so the
number quoted in a call is one the customer can open and verify. Screens: **`/clients/[id]`** ordered
like a renewal call, and an **Overview** leading with MRR, unbilled drift, the clients' own
**forward bookings** (their pipeline is our leading indicator) and one attention feed across the
portfolio. It found real money on first load — one client under-billed €150/mo. **L6 closed the
cycle** with the half that could *not* be derived — who to call, when the contract renews, what was
said last time — on three **operator-only** tables (`ClientAccount` · `ClientContact` · `ClientNote`,
`operator_only` RLS, so a hotel can never read our private assessment of them; `rls-verify` now runs
**101/101** and proves a hotel connection sees 0 of the 10 seeded CRM rows). The stage is **stated by
a human and argued with by the data** — `observedStage` derives one from behaviour, is never stored,
and the screens remark only when the two disagree; one direction of that disagreement catches a hotel
live in production and invoiced nothing. Contacts are deliberately **not `User` rows**: the owner who
decides on renewal usually has no login. The timeline **merges written notes with derived milestones**
(created, first booking, invoices), so a client has a history the first time the page is opened.
Overview gained **Renewals ahead** — our forward book beside the clients'. See `apps/operator/CLAUDE.md`.

**→ ✅ PLANS & PRICING (`/plans`) — SHIPPED 2026-08-05.** The pricing was always real (four constants,
correctly invoiced) and completely unreadable by the person who has to decide whether it is right.
Now it is a screen, computed by the **same functions that produce the invoices** — so there is
deliberately **no `docs/PRICING.md`**, which would be wrong within a month. Three parts, each priced
on a different thing on purpose: **platform fee by room count** (cost to serve), **module fee per
product** (value), **bundle discount by module count** (0 · 10% · 20%, on modules only — never on the
platform fee) because the 2nd and 3rd products cost us almost nothing to deliver: same database, same
onboarding, **no migration**. That discount is the price list finally agreeing with the architecture.
Plus one usage component — **2% on RevioDirect**, charged on bookings *our engine* produced and never
on the hotel's own phone reservations, against ~15% an OTA takes. The page also shows **all seven ways
to buy it**, who buys which, **what each product earns** (a stated *convention*, since no product
"owns" the discount — but `splitProportionally` guarantees the parts sum to MRR exactly), room-tier
spread, and **what the model changes about today's bills**. Two invariants are tested exhaustively
rather than spot-checked: **buying more never costs less**, and attribution always sums to MRR.
**Applied to production 2026-08-06** — the two August drafts moved €177 → €141.60 (backed up first,
dry-run inspected, transactional; July left alone because one of them is *paid*, and correcting a paid
invoice is a credit note, not an `UPDATE`). `generateInvoices` now **refreshes a draft instead of
skipping it** — an unsent invoice at a stale price is a wrong number waiting to be emailed — while
sent and paid invoices stay untouched.

**→ ✅ DEMO TENANTS STAY IN PRODUCTION (`Tenant.isDemo`, 2026-08-06).** Hotel Sofia Group and Black Sea
Resort are **ours, permanently, beside real clients**, so every rehearsal runs against the real
migrations, the real RLS and the real build rather than a staging copy that drifts. One rule, stated
in `apps/operator/lib/demo.ts`: **money and portfolio metrics exclude demo; operations and health
include it.** MRR, billed revenue, forward bookings, the attention feed, renewals and plan adoption
drop them (MRR is now honestly **€0** — we have no customers yet); sync health and error volumes keep
them, because a demo hotel's failing push is a real failing push. They are **never hidden, always
badged, and still invoiced** so the billing flow stays testable. `/overview?demo=1` shows the console
populated behind an amber banner, because "look at it and see nothing" is a poor way to check it
works. One click promotes a demo tenant to a real client with its whole history intact.

**→ 🔴 PHASE N (accounts & auth) IS NEXT, and N1 is a live hole.** There is **no rate limiting on any
login form** — RevioLink, RevioCRS, RevioPMS and the Operator console all accept unlimited password
attempts, and the operator console is one password away from every hotel's data. `auth.ts` also falls
back to a hardcoded dev secret when `AUTH_SECRET` is unset (fail-open; all four staff services do have
it set — `apps/booking` correctly has none, it has no auth). Sessions are stateless 7-day JWTs, so
**deactivating staff does not sign them out** and nothing can be revoked. Tasks N1–N5 cover
brute-force protection, password reset + invite flow, revocable sessions + remember-me, TOTP 2FA
(operator first), and password policy + auth audit + key rotation. Marketing/positioning copy for the future product websites is drafted
in `docs/POSITIONING.md`; the forward roadmap is at the top of `BUILD-PLAN.md`. See `BUILD-PLAN.md` for
the phased order, `ARCHITECTURE.md` for rationale,
`ACCESS-MODEL.md` for the access model, `DEPLOY.md` for the deploy runbook, and **`docs/RESTORE.md`** for
backup/restore (drilled 2026-08-05 — RTO ≈1 min, and it found that four production room photos already
point at bytes that no longer exist).

**→ ✅ V2 PLATFORM OVERHAUL COMPLETE (founder specs 2026-07-09, `docs/specs/`) — all phases A–F shipped,
tested, live.** Governed by six specs: `HIERARCHY.md`, `CM-GUIDE-V2.md` + `CM-UPDATES-V1.md` (RevioLink),
`CRS-GUIDE-V1.md` (RevioCRS — **two-tier precedence replaced the 4-level priority**), `PMS-GUIDE-V1.md`
(RevioPMS), `BOOKING-ENGINE-ADDENDUM.md` (build deferred; its three seams built). Delivered in order
**A foundations → B RevioLink → C RevioCRS → D/E RevioPMS → F assignment + gateway/compliance seams**
(tasks A0–F3). Headline additions: two-tier ARI precedence + push attribution + per-channel capability
map; CRS Analytics + STLY-364 + portfolio scope; PMS Reservation view / Guests / User Management /
Configuration, housekeeping smart-routing + inspection gate + scoped roles; the **charge-posting service**
(every folio line, outlet+tax tagged), split folios, **deposits-as-liability**, stay extras + city-tax
suppression, a jurisdiction-agnostic **Invoicing module** (gapless series, tax-per-rate), night-audit
report, room-assignment suggestions. **THREE integration boundaries, all mock-first with a real path:**
Channex (distribution) · **Stripe test-mode** (payments §4.5, F2 — TEST keys on Railway, never live) ·
**fiscalization** (§4.7, F3 — `TaxInvoice.fiscalRef` + jurisdiction pack; `docs/specs/BG-FISCALIZATION-
RESEARCH.md`). Real email (Resend) is wired (mock-log until `RESEND_API_KEY` set). Every screen's **Keep**
list was honoured. Older `docs/CM-REVISIONS.md` (2026-06-27) is superseded where the specs overlap it.

**→ 🟡 REVIODIRECT (phase K) — K1–K4 SHIPPED, local only, 2026-07-27→30.** The fifth app, `apps/booking`
(port 3004), governed by `docs/specs/BOOKING-ENGINE-DESIGN.md` + the founder's `BOOKING-ENGINE-ADDENDUM.md`.
**A guest can now book end to end**: `search → choose a room → hold + details + card guarantee → confirmed`,
writing the one shared reservation tagged `source = Direct` — so it lands in RevioCRS and on the RevioPMS
front desk with no integration step. That is the product's structural claim, and it is now demonstrated
rather than argued. Shipped: **all-in pricing** (K2 — one `computeStayCharges` used by the quote, the
summary, the confirmation, the email and the folio, so the first number a guest sees is the number they
pay); a **UX/UI overhaul** (K2b — two-month range calendar, pinned search bar, four-step progress, mobile
first); **room photos** (K3 — `RoomTypePhoto` + `@revio/storage`, bytes in object storage and never in
Postgres, `sharp` re-encode to WebP); **hold-on-open + the card guarantee** (K4 — a SetupIntent through
`@revio/payments`, no card fields anywhere, token + last4 only). Sold-out dates return **real** alternative
stays, re-quoted from the same availability engine. Branding is configured in **RevioCRS → Booking Engine**
(base preset, then edits; every `booking*` column nullable = inherit the email branding) and every derived
brand colour is **measured** to 4.5:1 rather than assumed — `apps/booking/lib/brand.test.ts` pins that
across twelve awkward hotel colours. Four shared packages came out of this work, each at the moment a
second caller appeared: `@revio/booking` · `@revio/email` · `@revio/payments` · `@revio/storage`.
**K11 room content SHIPPED (2026-08-03)** — a room can now describe itself: free-text description,
`sizeSqm`, a fixed `bedSetup` list and **35 curated amenities** in six groups (`packages/core/src/rooms/
amenities.ts`), edited in **RevioCRS → Rooms & Rates** as icon toggle-chips and read by a guest in a
**detail dialog over the results** (16:9 `object-contain` gallery, so the dialog stops resizing between
portrait and landscape photos). The amenity list is **fixed, not free text**, because Channex takes a room
type's `facilities` as a list of ids — fill it in once, push it to Booking.com later. Cards show only the
**four amenities that differentiate** (`headlineAmenities` ranks a sea view above air conditioning; the
first-four-of-the-list alternative prints "Air conditioning · Heating · WiFi · TV" on every card in the
hotel). Icon names live in core (pure data) and resolve to components in `@revio/ui/amenity-icon`, typed
so a missing icon is a build error.
**K9 DEPLOYED + the cross-system run PROVEN on production (2026-08-03).** RevioDirect is live at
`booking-production-8e50.up.railway.app/<slug>`, and the structural claim is now demonstrated rather than
argued. One booking made as a guest on the live site — `RV-07NR0F`, Deluxe Double, 4→6 Aug, €195 all-in —
appeared with **no integration step**: in **RevioCRS** Reservations tagged `source = Booking Engine`; as a
**RevioPMS** guest profile carrying the guest's own free-text request through untouched; on the **PMS
reservation view**, which states the point on screen ("one shared record, two phases … it is never a
synced copy") with the commercial half read-only from the CRS and the operational half empty and correct
(*no room assigned — assigned at check-in*, *no folio yet*); and on the **folio**, which reconciles to
`€192 room + €3 city tax = €195` — **the exact number the guest was quoted**, which is the all-in pricing
promise closing the loop. The card guarantee shows as *Card on file* (Stripe test-mode, token only).
**PHASE K IS COMPLETE (2026-08-05)** — K5 · K6 · K8 · K10 shipped; K7 was pulled forward during K2b.
**K8** gives RevioCRS a **Cost of distribution** view that keeps commission *paid* (a fact, each
channel's own rate × the revenue it brought) visually and structurally apart from commission *avoided*
(a counterfactual, and `null` rather than a guess when there is no OTA revenue to derive a rate from) —
`channelEconomics` in `@revio/core`. **K6** recognises a returning guest **server-side after submit**,
never through a live email lookup: on an unauthenticated page that endpoint is a guest-enumeration
oracle. `Guest.recognitionOptOut` silences it guest- *and* staff-facing, and is deliberately narrower
than erasure. **Still open:** `book.revio.app` DNS.
**Not built
and deliberately so:** real card collection (needs Stripe Elements + a live-mode decision), extras/upsell
(the step-3 slot exists and is empty), and any Operator visibility into the booking engine.

**→ ✅ BRAND IDENTITY (phase M) — SHIPPED 2026-08-03.** The founder's real marks replaced the placeholder
SVGs in all four staff apps (`design/brand/` holds the source PNGs; each app serves `public/mark.png` +
`app/icon.png`/`apple-icon.png`). **A brand mark is never re-drawn by eye** — the artwork is used as
delivered; only the Operator tile is synthesised, by mapping the RevioLink tile's accent to white so it
keeps the exact silhouette. Each app now has **one accent**: RevioLink cyan `#24d3ee` · RevioCRS indigo
`#818cf8` · RevioPMS emerald `#34d399` · **Operator none** (white/navy — it is the platform, not a
product). It appears in the sidebar mark, the active-nav rail, the wordmark tail, the avatar, the favicon
and selected chips, and **nowhere else**: primary buttons stay `brand-800` navy in all four. RevioPMS is
why that rule is written down — it had made `accent` its primary colour, and emerald put a primary button
beside the housekeeping board's green "Finish" button, two identical greens meaning different things; its
`accent` now mirrors `brand`. **RevioDirect deliberately gets no Revio identity at all** — it wears the
hotel's brand colour and the hotel's own logo as its favicon. See `packages/ui/CLAUDE.md`.

**→ ✅ REFINEMENT ROUND (founder docs 2026-07-20, `docs/specs/`) — BUILT AND SHIPPED as phases G · H · J.**
Everything described below is **done and live** except **J10 (PMS Close Day)**, which is still blocked on the
founder's §11 section. The intake is kept verbatim as the record of what was asked for; read it as
requirements that were met, not as a backlog. **THREE systems, three docs** (one doc per system; the `Revio Development Docs.docx`
title reads "RevioCRS" but that's a **typo — it's the RevioLink/CM doc**, founder-confirmed; the founder is
re-sending the corrected file). **RevioLink R1** (`CM-REFINEMENT-R1.md`) + **RevioCRS R2**
(`CRS-REFINEMENT-R2.md`) + **RevioPMS R1** (`PMS-REFINEMENT-R1.md`). CM + CRS **share** the Calendar / Bulk
/ Rooms & Rates changes — build them **once as shared components, reused across both** (paperclip=derived,
one bulk engine, one preview→apply→result modal everywhere). **RevioLink** asks: Dashboard Reservation-
Summary card (by action date); Calendar bulk-in-modal-over-calendar + remove derived filter + paperclip +
hide search; Bulk **multi-field editor + confirm-then-result modal** + rename "Restriction Rules"→"Your
active restriction rules"; Rooms & Rates vertical restack + **editable Rate Plan Linkage** (cycle/recalc/
precedence guardrails). **RevioCRS** adds on top: Dashboard YoY/LW toggle w/ basis labels; **Analytics full
redesign** (summary cards + evolution bar charts + performance-by-room-type, replacing the day table);
Reservations 3-click column sort; Guests **Notes** tab; Settings low-availability alert + staff CRUD on the
shared identity (+ the shared Calendar/Bulk/linkage changes). **RevioPMS** (10 screens): Front Desk
exception-strip + overdue/extend-checkout + FD-metric KPIs; Reservation-view action hub; **Guests
identity/merge + n≥2 preference guard + GDPR/blacklist**; Folios **Open/History split** + mandatory-deposit
check-in gate + checkout-readiness; **Extras & Charges** rename + void/qty + real catalog; Housekeeping
**role-scoped views** + Dirty→In progress→Awaiting inspection→Ready pipeline + per-cleaner assignment +
**clock-in** + event-stream analytics; Rooms beds/occupancy + floor-as-object + bulk-edit; Maintenance crew
view + On-hold + **OOO↔revenue loop**; **Configuration expansion** (E7 already shipped a base — §9 is the
target); **Staff & Access Management** rename + workforce roster + clock-in + user security. **Two pending
founder items:** PMS **§11 Close Day** section ("will add later today") and the re-sent corrected RevioLink
doc. Task phases **G (RevioLink R1)** + **H (RevioCRS R2)** + **J (RevioPMS R1)** — **all shipped**, J10 excepted.
