# Revio — Hotel Software Platform

Revio is a **composable line of hotel software products** that share one core. Each product is
sold and used independently, but they run on a single shared inventory engine so a hotel can buy
one today and add the others later with zero migration.

This file is the **big picture**. Every folder below has its own `CLAUDE.md` that narrows scope to
that module. When you work inside a module, Claude Code loads **this file + that module's file**, so
each module "knows it belongs to something bigger" while keeping its own boundaries. Read the local
`CLAUDE.md` before changing anything in a module.

## The products

The **platform brand is Revio**; each product has a market name. Engineering paths stay descriptive
(`@revio/core`, `apps/channel-manager`) — product names live in the UI and docs, not deep code paths.

| App (folder) | Product name | What it does | Sold to |
| --- | --- | --- | --- |
| `apps/channel-manager` | **RevioLink** | Push availability/rates/restrictions to OTAs, pull bookings back, keep them in sync. **First product, the demo, the priority sale.** | A hotel that already has a PMS |
| `apps/reservation` | **RevioCRS** | Direct booking engine, folio, guests, payments, reports. *(Phase 2)* | A small property with no OTA needs |
| `apps/pms` | **RevioPMS** | Front desk, housekeeping, minibar, operations. *(Phase 3)* | An operations layer over a foreign system |
| `apps/operator` | **Revio Operator** | **Our** admin console: all hotels, billing, integration keys, entitlements, sync health. | Internal (the SaaS operator) |

## The one rule that governs everything

**There is a single source of truth for availability**, and it lives in `packages/core`. The whole
reason the Channel Manager exists is to stop two guests booking the same room. If products kept their
own copies of inventory, we would recreate that exact double-booking problem *inside our own
platform*. So:

- **One database. One inventory core.** All four apps read and write inventory **only** through
  `@revio/core` — never with their own ad-hoc queries against inventory tables.
- Apps **never import another app's internals.** Apps depend on `packages/*`, not on each other.
- "Sold separately" is a **licensing** decision, not a code-separation decision — see Entitlements.

## How products are sold separately: Entitlements

A hotel account has **entitlements** (which modules it bought). The same login shows only the apps the
hotel is entitled to. Buying another product later just flips an entitlement — the data is already
shared. This is our edge over all-in-one suites (Mews/Cloudbeds) and pure channel managers
(SiteMinder): land with CM, expand into CRS/PMS without re-onboarding.

## Multi-tenancy & isolation

- Shared Postgres with **Row-Level Security**: every tenant-owned row carries `tenant_id`; the DB
  physically refuses to return another tenant's rows even if app code has a bug.
- Two perimeters: **Operator** (sees all hotels — operator console only) vs **Hotel** (sees only its
  own data and only purchased modules). Operator business data (contracts, billing, OTA tokens) lives
  in an admin schema the hotel can never read.
- Integration tokens are encrypted at rest and never exposed to a hotel.

## Connectivity is behind an adapter — demo runs on a mock

Every channel (Booking.com, Expedia, …) is reached through one `ChannelAdapter` interface in
`packages/core`. A `MockChannelAdapter` implements the same interface, so the **entire ARI loop runs
live on seeded demo data** before we hold any real OTA certification. When real OTA / Channex access
arrives, we swap the adapter — nothing else changes. **Build and demo against the mock first.**

## The ARI loop (the product, in one line)

`edit → derive → push → book → pull → re-push`. Everything in the Channel Manager either configures
this loop (Rooms & Rates, Restrictions, Channels, Mapping) or monitors it (Dashboard, Sync Center,
Error Center, Audit Log). See `apps/channel-manager/CLAUDE.md` and `docs/`.

## Tech stack

- **TypeScript end-to-end.** Shared domain types live in `packages/core` and are imported by every app.
- **Next.js (App Router)** for the apps; for the demo the API lives in Next route handlers calling
  `@revio/core` (modular monolith). Extractable to a standalone service later without rewriting domain logic.
- **Postgres + Prisma** (RLS enabled). **Redis + BullMQ** for the sync queue (in-process for the demo,
  externalized later).
- **Tailwind** + design tokens in `packages/ui` (derived from the Atlas direction — see `design/`).
- Package scope: `@revio/*`. Node ≥ 20, pnpm workspaces.

## Layout

```
apps/        channel-manager · reservation · pms · operator   (front-ends, each with its own CLAUDE.md)
packages/    core (domain + inventory + rates + restrictions + adapters) · ui (tokens)
docs/        spec & architecture (questionnaire answers, CM developer reference, architecture analysis)
design/      Atlas/Haven/Pulse handoff prototypes + Revio brand
```

## Conventions

- Money is integer **minor units** (cents) + an ISO currency code — never floats.
- Dates for inventory are calendar dates (`YYYY-MM-DD`), timezone-resolved at the property.
- Domain logic is **pure and tested** in `packages/core`; apps stay thin (UI + wiring).
- Don't widen a product's scope past what its `CLAUDE.md` says is in V1.

## Deployment

- **Repo:** https://github.com/Konstantin-Todorov/revio-platform (branch `main`).
- **Live — RevioLink (CM):** https://channel-manager-production-59bb.up.railway.app
- **Live — Operator Console:** https://operator-production-5eed.up.railway.app
- **Railway project:** `revio-platform` — one Postgres shared by all services; each app is its own web
  service. **Each service defines its own build/start via Railway config** (NOT a root `railway.json` —
  that applied to every service and was removed): build = Nixpacks `pnpm install → db:generate → next
  build` for its own `--filter`; start = `prisma migrate deploy` → `next start` on `$PORT`.
- **Auto-deploy:** both services track `main` — **every `git push` builds and deploys both
  automatically.** Migrations run on each deploy; the DB is never reset.
- **Adding an app** (CRS/PMS): `railway add --service <name>`, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
  patch its build/start to its own `--filter`, set source repo. See `DEPLOY.md`.
- Local: `pnpm --filter @revio/<app> dev`. Seed/inspect the remote DB from this machine via
  Postgres's `DATABASE_PUBLIC_URL` (the internal `DATABASE_URL` isn't reachable off-Railway).

## Auth (live)

Self-hosted email + password (bcryptjs) + signed JWT session cookies (jose). `getSession()` /
`getOperatorSession()` now resolve **real** identity; `middleware.ts` gates by cookie; `/login` lives in
each app outside the `(protected)` route group. CM cookie `revio_session`, operator `revio_op_session`.
`AUTH_SECRET` is set per Railway service. **Demo logins (password `revio1234`):** RevioLink →
`admin@hotelsofia.demo` or `owner@blacksea.demo`; Operator → `operator@revio.app`.

## Status

RevioLink + Operator Console are **built, tested, live, and behind login** with GitHub auto-deploy.
Operator onboards clients; **clients self-manage staff (roles) + properties** from RevioLink Settings.
Next (see `BUILD-PLAN.md` handoff): manual mapping editor → **RLS** (DB-level isolation) → real OTA
connectivity (Channex) → RevioCRS / RevioPMS. See `BUILD-PLAN.md` for the phased order, `ARCHITECTURE.md` for rationale,
`ACCESS-MODEL.md` for the access model, and `DEPLOY.md` for the deploy runbook.
