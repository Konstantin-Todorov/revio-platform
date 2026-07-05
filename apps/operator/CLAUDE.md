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
