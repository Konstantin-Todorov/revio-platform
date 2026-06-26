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

**✅ MOBILE LAYOUT FIXED in BOTH apps (2026-06-26).** The shell is now responsive: `Sidebar` is a
slide-over drawer under `lg` (backdrop + X + close-on-navigate) driven by a `ShellContext`; `Topbar`
has a hamburger (`MobileMenuButton`) shown only `< lg`; wide tables wrap in `overflow-x-auto` so the
page never overflows. Verified at 375 / 768 / 1280px in both channel-manager and operator. CRS/PMS now
inherit a correct responsive shell pattern (copy `components/shell/{ShellContext,MobileMenuButton}.tsx`
+ the Sidebar drawer + Topbar hamburger wiring).

**✅ RLS HARDENING — built & verified locally (2026-06-26); prod = a deliberate Phase 2 (see below).**
DB-level tenant isolation now exists as defense-in-depth on top of app-level scoping. Pieces:
- Migration `20260626130000_enable_rls`: `ENABLE`+`FORCE ROW LEVEL SECURITY` + a `tenant_isolation`
  policy on every tenant table, keyed on `app.tenant_id` (hotel) / `app.bypass='on'` (operator/system).
  Child tables (`RatePlanRoomType`, `ReservationLine`, no `tenantId`) isolate via an `EXISTS` check on
  their RLS-protected parent. `Tenant` keys on its own `id`.
- `packages/db/src/rls.ts`: `forTenant(id)` / `forSystem()` wrap each model op in a txn that sets the
  GUC transaction-locally (canonical Prisma RLS pattern; safe under pooling).
- CM: a per-request proxy `lib/db.ts` forwards `prisma.x.y()` to the session's tenant client → only the
  *import* changed in data/action files, not the ~100 call sites. Identity (`session`,`actions-auth`)
  uses `forSystem()`. Operator uses `forSystem()` (cross-tenant) everywhere.
- **RLS only enforces against a NON-superuser role** (superusers/`BYPASSRLS` ignore it; `FORCE` only
  reaches the owner). Local: created `revio_app` via `packages/db/prisma/rls-role.sql`; apps' `.env`
  connect as it; `packages/db/.env` (owner) is used by migrate/seed.
- **Verified locally:** as `revio_app` — no GUC → 0 rows; tenant A → only A; bypass → all; cross-tenant
  INSERT rejected ("violates row-level security policy"); cross-tenant UPDATE → 0 rows. App reads + a
  real "Simulate booking" write work; operator sees all tenants; tests core 18/18 + db 3/3 pass.
- **Prod rollout is Phase 2 in `DEPLOY.md`** (create `revio_app` on Railway, split migrate-owner vs
  runtime-restricted via `directUrl`, switch `DATABASE_URL`, verify, rollback-ready). Pushing the code
  alone is behaviour-neutral in prod (the Railway role is a superuser → policies bypassed until flipped).

**Real connectivity ≠ data loss:** demo content is DB data; real connectivity is an adapter swap
(Mock → real `ChannelAdapter`, same interface). Demo tenants keep `MockChannelAdapter`; real tenants get
real adapters; they coexist. Never point a real adapter at demo hotels.

**▶️ NEXT TASKS — pick up here.** Priority order (reprioritized by founder 2026-06-26):
1. ✅ **Mobile/responsive fix — DONE & DEPLOYED** (Phase 1 push, both apps, verified 375/768/1280).
2. ✅ **RLS hardening — DONE locally; Phase 1 code DEPLOYED (inert in prod).** Prod DB role is a
   superuser so the shipped policies are bypassed → behaviour-neutral. **Phase 2 (enforcement) is now
   scheduled LAST — AFTER RevioCRS + RevioPMS** (see note below). Phase 2 steps live in `DEPLOY.md`.
3. ✅ **Manual mapping editor — DONE.**
4. **Finish CM polish**, then **Real connectivity (Channex)** — see connectivity-test plan below.
5. **RevioCRS** then **RevioPMS** — new Railway services, **same Postgres + same `@revio/core` + same
   shell/scoping pattern** (this is the platform's core rule). Entitlements gate them.
6. **RLS Phase 2 (prod enforcement) — LAST**, once CRS/PMS tables exist so one migration covers every
   product's tenant tables. **CRS/PMS must, from day one, keep the tenant-scoping discipline** (query via
   a per-request tenant proxy like `apps/channel-manager/lib/db.ts`, reuse `@revio/db` `forTenant`/
   `forSystem`, carry `tenantId` on every tenant table) so the RLS flip later needs no rewrite.

**Connectivity test plan (test live API keys BEFORE any real client).** It's an adapter swap — the
`ChannelAdapter` interface + `MockChannelAdapter` already isolate it, and the adapter is chosen **per
tenant** (demo hotels stay on Mock; others get real adapters; they coexist — no data loss). Steps:
(1) implement `ChannexChannelAdapter` (same interface); (2) use **Channex sandbox + test API keys**
(stored encrypted in the operator's connectivity keys, per tenant, never shown to a hotel); (3) make a
dedicated internal **TEST tenant** ("Revio Test Hotel") wired to the real adapter pointed at the Channex
sandbox; (4) run the full ARI loop against sandbox (push ARI → verify in Channex's sandbox → make a
sandbox test booking → confirm the pull decrements availability → re-push); (5) only after the sandbox
loop is green + Channex certification, point a real client's tenant at the production adapter with their
real keys. Never point a real adapter at a demo hotel. Per-tenant mode flag: `mock | channex-sandbox |
channex-prod`, so one deployment serves all three at once.

**Minor cleanup noted:** `packages/db` has no `@types/node`, so its `tsc --noEmit typecheck` fails
("Cannot find type definition file for 'node'") — pre-existing, doesn't affect build/tests/app
typechecks. Add `@types/node` to `packages/db` devDeps when convenient.

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
