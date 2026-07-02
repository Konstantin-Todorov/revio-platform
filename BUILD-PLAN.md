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

**▶️ ROADMAP — V2 revisions (founder spec `docs/CM-REVISIONS.md`, 2026-06-27).**
Done & deployed: ✅ mobile/responsive shell · ✅ RLS (shipped inert in prod) · ✅ manual mapping editor ·
✅ Channex adapter **built + live-verified against the sandbox** (`@revio/connectivity`, local commits,
not yet wired into the app or deployed).

**Recommended order — settle the data model FIRST so we don't build twice (rationale below):**

- ✅ **Phase 1 — Core model — DONE + deployed** (a) inventory date-level (`totalRooms` safety-net;
  Rooms-to-sell + derived Rooms-sold); (b) currency on Property + conversion prompt + the 4 CRS FX
  fields per reservation; (c) rate-plan Min/Max stay + Advance-Purchase rolling-close.
- ✅ **Phase 2 — Two-stream mapping — DONE + deployed.** Room-Type stream (inventory/open-close) +
  Rate-Plan stream (rates/restrictions), mirroring Channex. ProductMapping kept but unused (cleanup later).
- 🟡 **Phase 3 — Wire real Channex — mostly done.**
  ✅ 3a: real ARI push via `@revio/connectivity`, opt-in per channel (`Channel.connectivityMode`:
  mock default | channex_sandbox | channex_prod), Re-sync button, mode+UUID in channel settings.
  ✅ 3b: **auto-push on every ARI edit** (recordPush → syncRealChannels; no-op for mock), **pull**
  (`pullChannel`: 7-day lookback, dedupe on externalId, cancel/modify update in place — derived sold
  self-corrects availability, unmapped → failed_import + Error Center, overbooking flagged, re-push
  after import; "Pull bookings" button per channel), **24h sync-health bar** on channel cards.
  ✅ 3c: **operator-managed encrypted keys** — `ConnectivityCredential` (AES-256-GCM via
  `@revio/db` encryptSecret/decryptSecret, key = `CONNECTIVITY_SECRET` env → AUTH_SECRET fallback;
  set on both Railway services), bypass-ONLY RLS policy (hotels see zero rows), Operator
  Connectivity screen (set/replace/remove, last-4 hint only), CM resolves per-tenant key first,
  env fallback. ⬜ Remaining: (i) scheduled auto-pull (needs cron/queue infra — pair with the
  Phase 5 email/notifications infra); (ii) import-loop live test needs a Channex-sandbox test OTA
  channel with a real booking.
- ✅ **Phase 4 — Calendar & IA redesign — DONE + deployed (2026-07-02).** Calendar = ALL room types as
  collapsible sections (`getCalendarBoard`), 7/14/30-day movable window + jump-to-date (2-yr horizon),
  Rooms filter + Customise-display row groups (`ParamMultiSelect`), Rooms-sold derived row, editable CTA.
  **+ Month-calendar view option (2026-07-02)**: Grid | Month toggle; classic month layout per room type
  (day cells = Sell/Sold/Rate + flag dots, same edit logic), prev/next month within the 2-yr horizon.
  **Bulk Update merged with Restrictions** (one screen; /restrictions redirects).
- ✅ **Phase 5 — Screen refinements — mostly DONE + deployed (2026-07-02).** Sync Center absorbed Error
  Center + Audit Log as tabs (+error badge; /errors,/audit redirect); Reservations filters (guest/#,
  channel, status, check-in range); **User Management = own Operations screen** (/users; Settings keeps a
  pointer). ⬜ Remaining: channel logos (cosmetic), Settings reservation-delivery emails + arrival
  notifications (**needs email + scheduler infra** — pair with scheduled auto-pull).
- ⬜ **Channex certification prep (before production keys).** Channex requires passing their **PMS
  certification** (docs.channex.io → pms-certification-tests): 14 scenarios run from OUR REAL UI against
  the staging sandbox, task IDs submitted via form, then a live screenshare review → production access.
  Gaps to close when we schedule it: (a) **full-sync = 500 days in ≤2 API calls** (our Re-sync pushes 14
  days); (b) **delta-only pushes** (test 13 — our auto-push resends the whole 14-day window per edit);
  (c) **booking acknowledgments** on pull (test 11); (d) demonstrate rate-limit compliance. Note: the
  hotel's Channex account lives on **staging.channex.io** (app.channex.io is a separate production login).
- **▶️ NEXT — RevioCRS** (founder spec **v2** captured 2026-07-02 → `docs/CRS-REFERENCE.md`: exact
  metric formulas, Hold lifecycle, modification rules, 4-level restriction priority, date-sensitive
  OOO/closure inventory, permission groups, performance targets, and its own 5-phase MVP order —
  property foundation + pickup-snapshot job → reservations/holds → rates → dashboard/metrics →
  distribution). Binding rules: `ChannelManagerConnector` adapter (RevioLink-internal = shared core,
  no network; third-party = push/pull later); **availability waterfall once in `@revio/core`**
  (Physical−OOO−Closed−Holds−Confirmed — CM's date-level inventory is the collapsed form); ONE metrics
  module read by Dashboard + Reports. Same shell/auth/DB; `hasReservation` entitlement gates it;
  new tables carry tenantId + RLS policy; third Railway service.
- **Then — Channex certification prep** (see the prep item above): do it AFTER RevioCRS, BEFORE the
  first real client goes live — cert has external lead time (Channex schedules a live screenshare), so
  don't leave it to the last minute; testing continues on the staging sandbox meanwhile.
- **Then — RevioPMS** (operations layer: front desk, housekeeping, minibar — spec TBD from founder),
  same pattern, `hasPms` gate. **RLS Phase 2 (prod enforcement) LAST** so one migration pass covers
  every product's tenant tables (`DEPLOY.md`).
- **The operator (us) stays the admin over everything**: Operator Console provisions clients + flips
  CM/CRS/PMS entitlements + holds encrypted connectivity keys; hotels self-manage staff/properties.
  All four apps = one Postgres, one `@revio/core`, one access model (`ACCESS-MODEL.md`).

**Why not wire/deploy Channex right now:** Phases 1–2 change the very things Channex depends on — the
inventory model (what "availability" means), the currency (what we send), and the mapping structure (the
two streams). Wiring Channex before them = building it twice. The adapter being done means Channex is
de-risked and ready to plug in **after** the model settles.

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
