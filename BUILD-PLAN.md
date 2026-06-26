# Revio — Build Plan

Order of work toward the Channel Manager demo. Each phase ends in something runnable.

---

## 📍 WHERE WE ARE (2026-06-26) — read this first if resuming

**Live & working** (GitHub auto-deploys `main`):
- **RevioLink (CM)** → https://channel-manager-production-59bb.up.railway.app — behind login.
- **Operator Console** → https://operator-production-5eed.up.railway.app — behind login.
- **Repo** https://github.com/Konstantin-Todorov/revio-platform · **Railway** project `revio-platform`
  (services `channel-manager`, `operator`, `Postgres`; per-service build/start config — NO root railway.json).
- **Auth done** (email+password, JWT cookie). Demo logins (pw `revio1234`): RevioLink
  `admin@hotelsofia.demo` / `owner@blacksea.demo`; Operator `operator@revio.app`.
- **Empty-hotel crashes fixed**; operator can onboard a client (org+Owner+property+entitlements+base rate).
- **Client self-service DONE** — in RevioLink Settings the Owner/Admin invites staff (role select +
  remove, tenant-scoped, role-gated in `lib/actions-users.ts`) and adds properties (chain support).

**⚠️ KNOWN ISSUE — MOBILE LAYOUT IS BROKEN in BOTH apps.** The chrome (`components/shell/Sidebar.tsx`
+ `Topbar.tsx` in channel-manager AND operator) is fixed-width desktop: the 248px sidebar never
collapses, tables overflow, the topbar search/switcher don't reflow. **Fix mobile BEFORE cloning the
layout into RevioCRS/RevioPMS** (otherwise the bug propagates). Plan: make the sidebar a slide-over
drawer under `lg`, add a hamburger to the Topbar, let `main` tables scroll/stack, test at 375/768px
(preview_resize). Do it once in a shared way so CRS/PMS inherit a correct responsive shell.

**Real connectivity ≠ data loss:** demo content is DB data; real connectivity is an adapter swap
(Mock → real `ChannelAdapter`, same interface). Demo tenants keep `MockChannelAdapter`; real tenants get
real adapters; they coexist. Never point a real adapter at demo hotels.

**▶️ NEXT TASKS — pick up here.** Priority order:
1. **Mobile/responsive fix** (above) — highest, blocks good CRS/PMS layouts.
2. **RLS hardening** — Postgres row-level security, defense-in-depth (app-level tenant scoping already
   enforces isolation today, proven via login). Steps, do carefully + test, don't break the live apps:
   (a) migration: `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY tenant_isolation ON "X"
   USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) =
   'on');` for every tenant-owned table; (b) a NON-superuser app DB role (Railway user is owner →
   superuser/owner BYPASS RLS, so either create a restricted role + point `DATABASE_URL` at it, or use
   `FORCE ROW LEVEL SECURITY`); (c) tenant-scoped Prisma client via `$extends`/interactive txn that runs
   `SET LOCAL app.tenant_id='<id>'` per request from `getSession().tenantId`; operator client sets
   `app.bypass='on'`; (d) verify locally with 2 tenants (A can't read B even with a bad query; operator
   sees all; apps don't return empty) BEFORE flipping prod. Risk: misconfig → empty data / 500s.
3. ✅ **Manual mapping editor — DONE** — `updateMapping` action + per-row `MappingEditDialog` in the
   mapping page let the hotel set external room/rate IDs (status → complete when both filled).
4. **Real connectivity (Channex / OTA adapters)** → lights up Connectivity screen + real mapping.
5. **RevioCRS** then **RevioPMS** — new apps, same core/DB, more Railway services; entitlements gate them.

**Also pending:** Billing (Stripe), Platform Health, operator Settings — fill in as their systems land.

**How to run/deploy:** `pnpm --filter @revio/<app> dev` (CM 3000, operator 3001). Seed/inspect remote DB
from local via Postgres `DATABASE_PUBLIC_URL`. Push to `main` = auto-deploy both. Local DB `revio_dev`;
tests DB `revio_test`. Full detail in `CLAUDE.md`, `ACCESS-MODEL.md`, `DEPLOY.md`, and memory.

---

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

## ✅ Phase 4 — Operational + editable screens (done)
- CRUD: **Rooms & Rates** (room types, rate plans incl. derived config + tags), **Restrictions**
  (rule builder), **Mapping** (per-channel + auto-fix), **Channel Settings** + connect channel,
  **Settings** (property form + users). **Bulk Update** (mass edits). Calendar **inline cell editing**.
- **Reservations** (read-only + cancel), **Sync Center**, **Error Center**, **Audit Log** render data.
- Every mutation: server action → `@revio/core`/`@revio/db` → Audit entry → mock push (Sync Center).

## ✅ Phase 5 — Live loop (done)
- "Simulate booking" → import (pull) → availability drops → re-push; cancel restores; overbooking
  onto a sold-out date is flagged + raised in the Error Center. Verified end-to-end in the browser.
- Tests: core 18/18 (vitest) + `@revio/db` integration 3/3 against `revio_test`.

## ✅ Phase 6a — Railway deploy (done)
- RevioLink live at https://channel-manager-production-59bb.up.railway.app on Railway (`revio-platform`
  project, one Postgres). Prisma Migrate runs on deploy. **GitHub auto-deploy on push to `main`** —
  proven end to end. Repo: https://github.com/Konstantin-Todorov/revio-platform.

## 🟡 Phase 6b — Operator Console (App 4, in progress)
- `apps/operator` (@revio/operator): all hotels overview, create client (org + owner + entitlements),
  toggle entitlements + plan per client, cross-tenant sync health. Operator perimeter (sees all tenants).
- Deploys as a second Railway service on the same Postgres; auto-deploys on push.

## Later (post-demo)
- Real connectivity (Channex first, then direct OTA adapters), per channel, behind the same interface.
- Reservation/CRS (Booking Engine, payments, folio, reports).
- PMS (front desk, housekeeping PWA, minibar).
