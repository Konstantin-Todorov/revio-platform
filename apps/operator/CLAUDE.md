# App: Operator Console (`@revio/operator`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. This is **our** internal admin panel.

> **Any screen you build here is held to `docs/UI-STANDARD.md`** — borrow the familiar shape, say it before it is read, one component per concept, and look at the rendered page.

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

## Integrations & payments (`/integrations`, 2026-09-09)

**Our own Stripe account** — the one hotels pay *us* through. Deliberately not the same thing as the
hotel's own Stripe (Connect, `@revio/payments/connect.ts`), which takes deposits from *guests* and
whose funds never enter our balance. Both exist; confusing them is expensive, so the screen says
which one it is in its first paragraph.

**Credentials are entered in the console, not in the database and not in an environment variable.**
The Channex keys live in Railway variables and that cost is visible on this very page as *set
elsewhere*: nobody can see what is installed, nothing records who set it or when, there is no way to
test it, and changing it needs a deploy. `PlatformCredential` fixes all four for the credential where
it matters most — encrypted with the same AES-256-GCM envelope as `ConnectivityCredential`, so one
key rotation covers both, and **never readable back**: the screen shows `sk_test_••••4242` and there
is no reveal.

Three rules carried over from `ConnectivityCredential`, each of which cost something once:

1. **Tested before stored, and a rejected key is refused.** Storing whatever was pasted is how a dead
   key sat on a screen looking healthy while a real hotel's channel did nothing for hours
   (2026-09-01). The one exception is deliberate: a key Stripe never *answered* about — a timeout, a
   rate limit, their outage — is stored `untested` rather than refused, because configuring payments
   must not require Stripe to be up at that moment.
2. **Never tested is not working, and it is not green.** Four states, and `untested` is amber.
3. **Check the status code, never the shape of the answer.** `stripe-check.ts` branches only on
   `res.status`. A Stripe error is valid JSON and `json.id` on it is simply `undefined` — the exact
   trap that produced 411 consecutive "success" events against a revoked Channex key.

⚠️ **Mode is chosen by a person and validated against the key, never inferred from it.** Stripe puts
the mode in the prefix, so inferring is trivial — and that is the trap: paste a live key into the
field you believe is sandbox and inference agrees with you while real cards are charged.
`validateSecretKey` refuses both directions. A live key in the sandbox slot is the dangerous one; a
test key in the live slot is merely broken and is refused just as firmly, because silently accepting
it leaves a "live" setup that can never take a payment, discovered by a customer.

⚠️ **Test and live are different accounts that cannot see each other's data.** Customer ids, saved
cards and payment intents created under one do not exist under the other, so switching mode migrates
nothing. Both modes are shown side by side rather than behind a switch, to make that structural.

## Taking the payment (2026-09-09)

**A redirect is not evidence.** The obvious design marks an invoice paid when the customer's browser
reaches the success page, and it is wrong in both directions: anyone can open that URL without
paying, and a customer who pays then closes the tab never reaches it. The only party that knows a
payment succeeded is Stripe, which is why `app/api/webhooks/stripe` exists and why `/paid` is
deliberately static — it looks nothing up and decides nothing.

⚠️ **The webhook is the most security-sensitive route in this codebase.** It is public (Stripe is a
server with no session) and it marks our invoices paid. Without a verified signature it is an
unauthenticated write saying "this customer has paid", and anyone who guesses the path clears their
own bill. Four properties hold it together:

1. **Raw bytes, then verify, then parse.** `req.json()` would destroy the bytes the signature is
   over; re-serialising changes key order and the check then fails for every genuine event. No field
   of the body is read before verification — *including which mode sent it*, because the body cannot
   be asked to authenticate itself.
2. **The timestamp is security, not metadata.** Without a tolerance a captured "paid" event replays
   forever. Five minutes, Stripe's own recommendation, checked before the MAC.
3. **Idempotent by `where` clause.** Stripe delivers at least once and retries on any non-2xx, so
   `updateMany({ status: { not: "paid" } })` and its count is the decision — same shape as the hold
   conversion in R1.
4. **Status codes are part of the design.** 400 only for "did not verify". Everything verified is
   200, handled or not: a route that errors on an event it does not care about is retried forever and
   eventually **disabled by Stripe**, taking the events we do care about with it.

Two guards beyond the signature, both defence in depth: the session must be the one we created for
*this* invoice (hence the unique index on `stripeSessionId`), and the amount and currency must match
what we asked for. Only an **issued** invoice can be settled — a draft has no number and its amount
can still move.

**Stripe is a payment rail, never an invoicing system.** Stripe Invoicing issues documents under its
own numbering and Bulgarian law wants one gapless ascending run per company
(`OperatorInvoiceSeries`); a second source of invoice numbers is a compliance defect. So Checkout
carries one line named with *our* invoice number, and the document the customer files is ours.

`pnpm --filter @revio/operator webhook-verify` fires real HTTP at the real route and checks the
database — forged, unsigned, stale, genuine, replayed, wrong-amount. The unit tests prove the
signature function refuses a forgery; only this proves the route *calls* it. Removing the check makes
it go red on "a forged signature is refused" with the invoice marked paid, which is what it is for.

## VAT: three registrations, not a toggle (2026-09-09)

`decideVat` read `vatId != null` as "registered" and charged the domestic rate. Bulgaria has a
**third state**, and it is the one we are in: **чл. 97а ЗДДС** gives a real BG VAT number valid only
for cross-border services. Under it we hold a number and are nonetheless **forbidden to state VAT on
a Bulgarian invoice** (чл. 113, ал. 9) and cannot deduct input VAT (чл. 70, ал. 4).

So with `BG205090014` on file, every Bulgarian invoice would have carried 20% we may not charge.
Zero had been issued to a real client, which is the only reason this was a defect and not a credit
note. Five tests go red on the old two-state line.

⚠️ **`art97a_domestic` is not a 0% rate.** A supply on which VAT may not be *stated* is different
from a zero-rated one, and an invoice printing "VAT 0%" where the law wants the чл. 113, ал. 9 ground
is a defective document. `suppressVatLine` carries that to the renderer; the rate alone cannot.

`vat-threshold.ts` watches the other half: чл. 96 registration becomes mandatory above **EUR 51,130
of domestic turnover in a calendar year** — a calendar-year test, not a rolling twelve months — with
**seven days** to apply. EU B2B sales are supplied where the customer is and never count toward it.
The deadline starts with an invoice rather than a date, so software watches it.

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
