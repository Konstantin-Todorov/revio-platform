# App: Operator Console (`@revio/operator`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. This is **our** internal admin panel.

The "one admin panel for us, all hotels below." It is the **Operator perimeter**: it sees across all
tenants. A hotel can never reach this app or its data.

## Scope
- **Hotels/tenants** — list, onboard, suspend; per-tenant health at a glance.
- **Entitlements** — which products (CM / CRS / PMS) each hotel has bought; flip to grant/revoke.
- **Billing** — plan per hotel (CM priced by room-count tier: 0–30, 31–50, 50–100, …), invoices.
- **Connectivity keys** — OTA/Channex credentials, encrypted; never shown to hotels.
- **Sync & platform health** — cross-tenant sync status, error volumes, queue depth.
- **Audit** — operator-side actions.

## Round 2 (phase L, 2026-08-05) — from a viewer to a console

The first build counted things. Counts tell you the platform is alive; they never tell you which
customer to call. Everything below derives that instead, and the derivations are **pure and tested**
(`lib/attention.ts`, `lib/upsell.ts`, `lib/pricing.ts` — 29 tests) because every threshold in them is
a judgement that will be argued with once there are real customers, and that kind of rule rots
quietly when it is spread across JSX.

**`clientAttention` — severity means *how soon*, not how bad.** `act` is losing money or trust now,
`soon` is drifting toward churn, `note` is worth knowing before a call. Two rules are load-bearing
and both are tested: a **suspended** client reports the suspension and nothing else (listing "no
bookings in 30 days" under a locked account is telling someone their car won't start while it is on
the ramp), and **nothing fires inside a 14-day grace period** because everything is unused on day
one. The test that matters most asserts a healthy client produces **zero** flags — a console that
cries wolf gets ignored, which is worse than one that says nothing.

**`clientOpportunities` — two numbers, and the UI leads with theirs.** `clientValueMinor` is what it
is worth to the hotel; `monthlyUpliftMinor` is what it adds to our MRR. A pitch built on our uplift
is a quota conversation; one built on their saving is a business conversation. Where their side
cannot be computed honestly it is **null**, never a flattering estimate.

The RevioDirect pitch is priced by **`channelEconomics` — the same function behind the hotel's own
Cost of distribution screen**. That is the whole point of one shared core: the number quoted in the
call is the number they can open and verify, and if the two ever disagreed the pitch would be
worthless. One implementation, so they cannot. It is labelled `fair` not `strong` because the
commission is fact while the share that shifts direct is an assumption, stated on screen as such.

**Room-count tiers (`tierForRooms` / `tierDrift`)** finally implement the pricing model that has been
stated since the first architecture note — 0–30, 31–50, 51–100, 100+ — and that nothing ever
computed. `plan` was whatever was typed at onboarding and never moved, so a hotel that opened a
second building stayed on Starter forever. **Over-billing is reported as plainly as under-billing**:
a hotel that closed a wing and is still paying the bigger tier finds out eventually, and hearing it
from us is the difference between a credit note and a cancellation.

⚠️ **Tier drift is computed from `units` (physical rooms), never `roomTypes` (a catalogue of 6–11).**
Using the wrong one put the same client in two different tiers on two different screens; caught
before shipping, and the reason `getClients` exposes `units`.

Screens: **`/clients/[id]`** is ordered like a renewal call — what is wrong, who to call and when it
renews, what they are worth, what to sell them, then what was said last time — because it has to
survive being read thirty seconds before dialling. **Overview** leads with MRR, unbilled drift, the
clients' own forward bookings and the attention feed; the seven raw counters are the footer.

`TrendChart` is deliberately **not** the CRS's `EvolutionChart` (a dual-axis room-nights-vs-ADR
comparison — a shape this screen never needs). It stays in this app rather than `packages/ui`
because the platform rule is to extract when a *second* caller appears, not speculatively.

## L6 (2026-08-05) — the relationship half, and the first thing here that needed storage

L1–L5 derived everything from data the platform already held. L6 could not: **who to call, when the
contract renews, and what was said last time** are not derivable — someone has to write them down.
Three operator-only tables (`ClientAccount` · `ClientContact` · `ClientNote`), each carrying the
`operator_only` policy, so a hotel cannot read a word of our private assessment of them. That is
stricter than `tenant_isolation` **on purpose**: tenant-isolated data is the hotel's own and they are
entitled to it; this is *ours about them*.

**The stage is stated, not computed — and the console argues with it.** `observedStage` derives a
stage from behaviour and is never written anywhere; the screens show it beside the stage an operator
typed and remark only when the two disagree. Auto-computing would silently overwrite a human
judgement; never checking would let that judgement rot for a year. The disagreement is the only part
that tells you something you did not already know — and one direction of it (`Marked prospect but
live`) catches a hotel running in production while being invoiced nothing.

**`accountAttention` is separate from `clientAttention` and concatenated by the caller.** One asks
whether their software is working, the other whether we are looking after them; both belong in the
same morning feed, because "renews in 12 days" and "5 open sync errors" are the same day's work. The
suspension rule is **restated** in the new module rather than inherited — it is exactly the kind of
invariant that gets lost the moment two flag sources are merged, and there is a test for it.

⚠️ **Only calls, emails and meetings count as contact** (`CONTACT_KINDS`). A note is you writing
something down *about* them. Counting notes as contact would report a warm relationship with a
customer nobody has actually spoken to since March — which is the failure this flag exists to catch.

`rollRenewal` clamps the day of month (31 Jan + 1 month is 28 Feb, not 3 March) and anchors on the
**old** renewal date, not today, so a contract renewed three weeks late keeps its anniversary. Both
are tested, because a renewal date that drifts a little every year is a bug nobody notices for years.
Marking a client renewed also **writes a log entry** — a renewal that only moves a date leaves no
evidence it happened.

The timeline **merges what we wrote with what the platform already knew** (created, first booking,
invoices issued and paid), derived rather than stored, so every client has a history the first time
the page is opened instead of starting blank on the day the feature shipped. Future-dated entries
are excluded rather than sorted in — the renewal date is a real event with a real date, and dropped
into a list headed "what happened" it sits above last week's call.

**Overview** gained *Renewals ahead*: our own forward book beside the clients'. Every other number on
that screen is revenue already being earned; this is revenue that has to be re-won, with a date on it.

`lib/account.ts` — 31 tests. Total across the four derivation modules: **72**.

## Plans & pricing (`/plans`, 2026-08-05)

The pricing was always real — four constants in `lib/pricing.ts`, correctly applied to every invoice —
and completely invisible to the person who has to decide whether it is right. **A price nobody can
read is a price nobody can argue with**, which sounds like an advantage until the first customer asks
why the third product costs what it does. `/plans` is the price list, and it is computed by the same
functions that produce the invoices, so the published price and the charged price cannot drift apart.
**There is deliberately no `docs/PRICING.md`** — a second copy of these numbers in markdown would be
wrong within a month.

Three parts, each priced on a **different thing on purpose**:

| Part | Priced on | Why |
| --- | --- | --- |
| Platform fee | room count | cost to serve — a 200-room resort costs more to carry than a 12-room guesthouse whatever it bought |
| Module fee | per product | value — what the product does for them |
| Bundle discount | number of modules (0 · 0 · 10% · 20%) | the 2nd and 3rd products cost us almost nothing: same database, same onboarding, **no migration** |

The discount applies to **module fees only, never the platform fee** — that fee does not get cheaper
because they bought more software. It is steepest at the third product because the platform thesis is
"land with one, expand with zero migration"; if the third module cost the same as the first, the price
list would be arguing against the architecture.

Plus one **usage** component: `DIRECT_BOOKING_FEE_PCT` (2%) on RevioDirect. It is the only place we
earn more when the customer earns more, and it is charged on `BOOKING_ENGINE_SOURCE_NAME` — bookings
*our engine* produced — **not** on every `category = "direct"` booking. A hotel's own phone
reservations are business they won without us; charging for them would make the fee feel like a tax on
their own guests, which is exactly the resentment OTAs create.

⚠️ **Two invariants are tested exhaustively, not by spot-check**, because both are one edited constant
away from being false:
- **Buying more never costs less.** Push the 3-module discount high enough and the full platform slips
  below the price of the most expensive pair. The test walks every combination × every tier.
- **`attributeRevenue` sums to exactly MRR.** Revenue-by-product is a *convention* — once a discount
  exists there is no true answer to which product surrendered it, and the platform fee is nobody's —
  and the page says so on screen. What must not happen is the parts disagreeing with the total by a
  few cents, which makes every other number on the page suspect. `splitProportionally` uses
  largest-remainder for this; rounding each share independently loses or invents money.

The page ends with **what the model changes about today's bills**, per client, against the last
invoice actually sent. A repricing that can only be discovered from an invoice is not a decision, it
is an accident — and nothing moves until someone generates invoices on `/billing`.

## Demo tenants in production (`Tenant.isDemo`, 2026-08-06)

Hotel Sofia Group and Black Sea Resort **stay in production permanently**. The alternative is a
staging copy of a five-app platform sharing one database, one Channex account and one bucket — a
second environment to keep in sync, which always drifts, so the thing you tested stops resembling the
thing customers use exactly when it matters. Testing in production means every rehearsal runs against
the real migrations, the real RLS and the real build.

The cost is two fake hotels inside every number this console reports. **A console built to stop us
counting things that do not matter cannot itself report revenue that does not exist** — €283.20 of
imaginary MRR is worse than no MRR figure, because it looks true. So `lib/demo.ts` states one rule:

> **Money and portfolio metrics exclude demo. Operations and health include it.**

- **Excluded:** MRR, billed revenue, unbilled drift, forward bookings, the attention feed, renewals,
  revenue by product, plan adoption, the client counter.
- **Included:** sync health, error volumes, queue depth, search. A demo hotel's failing push is a
  *real* failing push — catching it early is the whole reason they live in production.
- **Never hidden, always badged.** Their own detail page works in full, flags and all, which is how
  the flags themselves get tested.
- **Still invoiced**, deliberately, so the billing flow stays testable end to end. Those invoices
  simply never reach a total.

⚠️ With no real customers the Overview is honestly **all zeros** — and "look at the console and see
nothing" is a poor way to check the console works. `/overview?demo=1` includes them behind a loud
amber banner. The default stays honest; the toggle is opt-in and never sticky.

One click flips the flag either way. A demo tenant that becomes a paying customer keeps its whole
history instead of starting again on a fresh tenant, and a real client can be borrowed for a test.

## Boundary
Reads cross-tenant data through `@revio/core` admin APIs that bypass tenant RLS **only** under an
operator identity. Never embed hotel-facing screens here; link out instead. Keep operator business data
(contracts, tokens, billing) in the admin schema, isolated from tenant data.

## Platform history (`/platform-history`)

This is the operator's **curated decision record**, not a second git log and not a customer-facing
release feed. `lib/platform-history.ts` holds two typed, read-only manifests:

- milestones record only changes that altered what the platform could safely promise, with commit ids
  or named verification controls as evidence;
- the roadmap uses **Now / Next / Later**, MoSCoW priority and `S–XL` effort. Effort describes shape,
  never a promised delivery date. Every `Now` item is a launch requirement; adding one means moving
  another out rather than silently increasing capacity.

Do not read `.git` at runtime: a production image is not guaranteed to contain repository history,
and hundreds of implementation commits are not an operating narrative. Do not add a database table
until a second writer or runtime status exists; today this is versioned platform metadata with one
caller, so it belongs in this app. Git and the module guides remain the detailed source of truth.

## Status (2026-07-05) — all screens built + live
`https://operator.reviosoft.app`. Built: **Overview** (cross-tenant stats + per-client
health), **Clients** (onboard = tenant+owner+property+entitlements; toggle CM/CRS/PMS; suspend/activate),
**Connectivity** (per-tenant encrypted Channex keys, last-4 hint only), **Platform Health**
(`getPlatformHealth` — 24h sync success %, failed syncs, open errors by severity, per-client health,
recent failures), **Settings** (your account + operator-staff CRUD via `actions-settings.ts` —
super-admin gated, keeps ≥1 super admin, no self-removal + platform info), **Billing**
(`lib/pricing.ts` plan-base + per-product module fee → monthly price + MRR; `Invoice` table with
**operator-only bypass RLS** so hotels can never read billing; `actions-billing.ts` generateInvoices +
draft→sent→paid; **payments are MOCKED — no gateway, no card, no money moved**; real Stripe is future).
Data reads via `forSystem()` (bypass RLS = operator perimeter). **Entitlement gating verified**: a client
with one/some/all products is correctly gated per app; toggling flips access.
