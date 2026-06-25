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

## Phase
Thin version can come alongside the CM demo (tenant list + entitlements + sync health) so the
"operator over many hotels" story is demonstrable. Full billing later.
