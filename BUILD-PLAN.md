# Revio — Build Plan

Order of work toward the Channel Manager demo. Each phase ends in something runnable.

## ✅ Phase 0 — Foundation (done)
- Monorepo (pnpm workspaces), nested `CLAUDE.md` system, TS config.
- `@revio/core`: domain types + availability + derived-rate + restriction engines + channel adapter
  interface + mock adapter. Core math verified.
- `@revio/ui`: design tokens from the Atlas palette.
- Architecture & decisions recorded.

## ✅ Phase 1 — Data layer & demo seed (done)
- `@revio/db`: Prisma schema for all core entities + monitoring (Sync/Error/Audit), `tenantId`
  everywhere. Pushed to local Postgres 16 (`revio_dev`). *(RLS policies: raw-SQL migration, pending.)*
- Seed reproduces the **reference screenshot on live dates**: Hotel Sofia, 6 room types, 7 rate plans
  (Standard manual; Non-Refundable/Breakfast/Long-Stay/Trip.com/Corporate/Early-Booker derived via
  `@revio/core`), 4 channels + 168 mappings (5 unmapped), 720 daily prices, reservations, sync/error/audit.
- Verified: derived engine yields the screenshot's exact NR/Breakfast rows; current week matches
  availability `12,12,10,8,6,6,8`, Friday stop-sell, Saturday CTD.

## ✅ Phase 2 — Channel Manager app shell (done)
- Next.js `@revio/channel-manager` (RevioLink) on `localhost:3000`. Navy chrome, property selector,
  sectioned left nav, all 12 routes wired. Tailwind + Hanken Grotesk + Atlas tokens. All routes 200.

## 🟡 Phase 3 — Core screens (the demo spine) — mostly done
- ✅ **Dashboard** (health cards + channel status + recent activity + quick actions + reservations).
- ✅ **Calendar** (ARI grid, room-type tabs, 7/14/30d, derived rates computed live, flags) — read-only.
- ✅ **Rooms & Rates**, ✅ **Channels** (mapping %), ✅ **Reservations**, ✅ Sync/Error/Audit (read).
- 🟦 Remaining: **inline cell editing** on the Calendar; Bulk Update / Restrictions / Mapping / Settings
  forms (currently wired-to-data placeholders).

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
