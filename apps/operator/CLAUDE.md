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

Screens: **`/clients/[id]`** is ordered like a renewal call — what is wrong, what they are worth,
what to sell them, then the evidence — because it has to survive being read thirty seconds before
dialling. **Overview** leads with MRR, unbilled drift, the clients' own forward bookings and the
attention feed; the seven raw counters are the footer.

`TrendChart` is deliberately **not** the CRS's `EvolutionChart` (a dual-axis room-nights-vs-ADR
comparison — a shape this screen never needs). It stays in this app rather than `packages/ui`
because the platform rule is to extract when a *second* caller appears, not speculatively.

**Still open:** L6 — the CRM half (contacts, lifecycle stage, renewal date, notes, activity
timeline), which needs an operator-only `ClientAccount` model with the same `operator_only` RLS that
`Invoice` and `ConnectivityCredential` carry, so a hotel can never read our notes about them.

## Boundary
Reads cross-tenant data through `@revio/core` admin APIs that bypass tenant RLS **only** under an
operator identity. Never embed hotel-facing screens here; link out instead. Keep operator business data
(contracts, tokens, billing) in the admin schema, isolated from tenant data.

## Status (2026-07-05) — all screens built + live
`https://operator-production-5eed.up.railway.app`. Built: **Overview** (cross-tenant stats + per-client
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
