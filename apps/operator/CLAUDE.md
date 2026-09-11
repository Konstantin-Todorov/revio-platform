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

## Pricing moved to `@revio/core`, and a trial is not revenue (2026-09-11)

`lib/pricing.ts` is now a **shim**. The model itself lives in `@revio/core` `billing/plan-pricing.ts`
because a second caller appeared: the founder asked for a billing section inside the three hotel
products, and an app may never import another app's internals. It belongs there on its own merits —
constants and arithmetic, no database, no framework — and the point of moving rather than copying is
that the figure a hotel reads and the figure we invoice are produced by the same function.

The shim keeps the operator's own spellings: `Entitlements` (identical to core's) and `ProductKey`,
which in core is `BilledProductKey` because **`ProductKey` there means `"cm" | "crs" | "pms"`** — the
short key a URL, an email and a `ProductTrial` row use. Two types with one name is a real bug class;
it mislabelled a product on this very page once this week.

⚠️ **`billableEntitlements` — a trial was being invoiced.** A trial is an entitlement flag, so
`hasPms` is `true` during a RevioPMS trial. `generateInvoices` priced straight from those flags, so
every promise the platform makes about a trial was contradicted by the bill — and because the bundle
discount is priced by the **number** of modules, a third product arriving on trial also re-priced the
two they really do pay for. MRR had the same fault in the other direction: revenue that does not
exist. Both now price on `billedEntitlements`; `entitlements` stays the *held* set, because the
screens that ask "what can they open" want exactly that. Found while building the hotel's own billing
screen, which would have shown the customer the wrong number with our name on it. No real client had
been invoiced yet.

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

## The menu: three levels, and the fourth attempt is the one that stuck

```
 rail (68px)   panel (232px)        page
 ┌────┬──────────────┬─────────────────────────────┐
 │ ▣  │ Operations   │  Integrations               │
 │ ◉  │  Health      │  ┌────────┬──────────────┐  │
 │ ◈  │  Errors      │  │ Details│ Subscription │  │ ← level 3, owned by the page
 │ ◐  │ ▸Integrations│  └────────┴──────────────┘  │
 │ ⚙  │  Connectivity│                             │
 └────┴──────────────┴─────────────────────────────┘
```

**Level 1 — areas as icons.** Seven, learned once and then hit by muscle memory. The fourteen
labelled links they replaced had to be *read* every time, which is the tax this removes.

**Level 2 — sections, VERTICAL.** The founder's instruction and his own reference screenshot:
*"first a vertical menu, and then if needed, add horizontal inside one of them."*

**Level 3 — horizontal tabs inside a page**, for several views of one record: the client's three
tabs, Stripe's two modes. Owned by the pages, not by `navigation.ts`.

⚠️ **Why vertical beats horizontal at level 2, having tried both.** A tab row does not scale and it
*competes*: Operations has five sections and Settings four, and as tabs they sit directly above
whatever tabs the page itself has, leaving the reader to work out which row means what. Down the
side there is no competition, there is room for a line of explanation, and a seventh section changes
nothing about the layout. It is also why the panel can **stay on a detail page** where the tab row
had to disappear — and losing the menu when you drill in is how somebody gets stranded.

The four attempts, so a fifth does not repeat them: fourteen flat links (*chaotic*); headings over
the same fourteen (*"it still reads as one long, amateur list"*); a rebuild reverted as off-design;
areas with horizontal tabs (worked, but put the menu in two directions at once).

**Settings has no navigation of its own any more.** It used to render `SettingsNav` inside the page,
so this console had two vertical menus doing one job, side by side on that screen and nowhere else.
Settings is now an area like any other and `SectionPanel` is that menu — `docs/UI-STANDARD.md` rule
3, one component per concept. The three hotel products keep `@revio/ui/settings-nav`: they have one
settings screen and no area rail, so for them it is still right.

⚠️ **A phone gets `MobileNav`, not a shrunken rail.** The rail trades width for two levels at once
and a phone has no width to trade; forcing it through gives a 68px drawer of unlabelled icons. Same
routes, same order, same names, flattened into one labelled list.

`navigation.ts` is the only place that decides what belongs where — the rail, the panel, the mobile
list and the content offset all read it, so the gap and the panel cannot disagree about how wide the
chrome is. **No route ever changes from it**, which is what makes a navigation change safe to ship.

`shell-view.test.tsx` renders the real chrome with the app's own compiled CSS
(`OPERATOR_SHELL_PREVIEW=… pnpm --filter @revio/operator test`). Two of the four attempts were green
and rejected on sight, so looking is not optional here.

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

## Money going back out (§S2, 2026-09-11)

A refund or dispute in Stripe used to leave `Invoice.status = "paid"` and nothing anywhere said
otherwise — our books and Stripe's would disagree silently, and the first anyone would know is a bank
balance that did not match.

⚠️ **`status` never moves back off "paid", and that is the design rather than a shortcut.** The
invoice records a supply that happened and a payment that happened, and both stay true after the
money is returned. Flipping it to unpaid would rewrite history **and** put the customer back on the
chase list as though they had never paid — an untrue story about somebody who paid and was refunded.
So `refundedMinor` / `refundedAt` / `disputeStatus` sit *beside* it as their own facts.

**Issuing a credit note is deliberately not done.** That is a legal document with its own numbering
and its own rules, and whether one is owed is the accountant's call. The screen says so in those
words rather than leaving the operator to wonder.

Three details that are not obvious:

- **A refund event carries a charge, not a Checkout session**, so `metadata.revioInvoiceId` is often
  absent. `createCheckoutSession` writes our invoice id onto the payment **intent** as well — that
  second copy exists for exactly this, and the intent is what the route matches on. Where Stripe does
  echo the metadata back it is checked *against* the intent, never believed instead of it.
- **`amount_refunded` is cumulative on the charge.** Two partial refunds arrive as two events and the
  second already carries the total, so storing the larger of stored-and-incoming makes a replayed or
  out-of-order delivery harmless. Reading the per-refund amount would double-count twice over.
- **A dispute keeps Stripe's own status verbatim**, never collapsed to a boolean: "needs_response"
  and "lost" are different amounts of trouble, and the operator must tell them apart without opening
  Stripe.

`webhook-verify` covers all of it over real HTTP — partial, out-of-order, full, disputed, and a
forged refund refused exactly as a forged payment is.

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
draft→sent→paid; manual settlement remains for bank transfers and Stripe Checkout settles card
payments only after its signed webhook verifies the exact stored session and amount).
Data reads via `forSystem()` (bypass RLS = operator perimeter). **Entitlement gating verified**: a client
with one/some/all products is correctly gated per app; toggling flips access.
