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

**▶️ NEXT TASK (agreed): client self-service in RevioLink Settings.** The Settings page
(`apps/channel-manager/app/(protected)/settings/page.tsx`) is the target. Build:
1. **Users & Permissions** — Owner/Admin invites staff (name, email, role ∈ owner|admin|
   revenue_manager|distribution_manager|read_only), edits role, removes. Scope every query/mutation to
   `getSession().tenantId`. New user gets demo password `revio1234` (prod = invite link). Role-gate:
   only owner/admin manage users. `getSettings()` already returns `users`. Add `apps/channel-manager/
   lib/actions-users.ts` (inviteUser/updateUserRole/removeUser) + dialogs (reuse Modal/Field patterns).
2. **Add Property** — Owner adds another property to their tenant (chain support). `addProperty` action
   (name, baseCurrency, timezone) creating a Property under `session.tenantId`; it shows up in the
   top-bar WorkspaceSwitcher (already tenant-scoped).
3. *(optional)* **Manual mapping editor** — let the hotel type external room/rate IDs per channel in the
   Mapping screen (real OTA-catalog matching waits for the Channex/OTA connectivity phase).

**Then:** RLS hardening (DB-level isolation) → real connectivity (Channex) → RevioCRS/RevioPMS.

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
