# Revio — Build Plan

Order of work toward the Channel Manager demo. Each phase ends in something runnable.

## ✅ Phase 0 — Foundation (done)
- Monorepo (pnpm workspaces), nested `CLAUDE.md` system, TS config.
- `@revio/core`: domain types + availability + derived-rate + restriction engines + channel adapter
  interface + mock adapter. Core math verified.
- `@revio/ui`: design tokens from the Atlas palette.
- Architecture & decisions recorded.

## Phase 1 — Data layer & demo seed
- Prisma schema for the core entities (Property, RoomType, RatePlan, Product, Channel, Mapping,
  Reservation, Restriction rules, Audit entries), `tenant_id` everywhere, RLS policies.
- Seed = the reference screenshot: **Hotel Sofia**, room types (Deluxe Double, Superior Twin, Family,
  Suite), rate plans (Standard, Non-Refundable derived −10%, Breakfast derived +€12), channels
  (Booking.com, Expedia, Trip.com, Agoda) with mappings, and a stream of imported reservations.
- A small `DemoSyncRunner` that drives the mock adapters so Sync Center / Error Center have live data.

## Phase 2 — Channel Manager app shell
- Next.js app `@revio/channel-manager`: navy chrome, top bar with property selector, left nav, routing
  for all screens. Tailwind wired to `@revio/ui` tokens.

## Phase 3 — Core screens (the demo spine)
- **Dashboard** (distribution health cards + recent activity + quick actions) — matches screenshot.
- **Calendar** (ARI grid, inline edit, cell actions) — the centerpiece.
- **Rooms & Rates** (room types, rate plans, derived rates, policies, meal plans).
- **Channels + Mapping** (connected channels, add channel, mapping screen, channel settings).

## Phase 4 — Operational screens
- **Reservations** (read-only imports), **Sync Center**, **Error Center**, **Audit Log**,
  **Bulk Update**, **Restrictions**, **Settings**.

## Phase 5 — Make the loop live
- Wire edit → derive → push (mock) → emit booking → pull → availability drop → re-push, so the demo
  visibly behaves like a real channel manager end to end.

## Phase 6 — Operator console (thin) + Railway deploy
- Operator app: tenant list, entitlements toggle, cross-tenant sync health.
- Deploy to Railway (Postgres + Redis + web). Demo URL to show the first hotel.

## Later (post-demo)
- Real connectivity (Channex first, then direct OTA adapters), per channel, behind the same interface.
- Reservation/CRS (Booking Engine, payments, folio, reports).
- PMS (front desk, housekeeping PWA, minibar).
