# Revio — Hotel Software Platform

A composable line of hotel software — **Channel Manager**, **Reservation/CRS**, **PMS** — sharing one
inventory core, sold separately, run by one operator over many hotels.

> **Live:** RevioLink (Channel Manager) → https://channel-manager-production-59bb.up.railway.app
> · **Repo:** https://github.com/Konstantin-Todorov/revio-platform · pushes to `main` auto-deploy on Railway.
> See [`DEPLOY.md`](DEPLOY.md).

Start with **[`CLAUDE.md`](CLAUDE.md)** (the big picture), then **[`ARCHITECTURE.md`](ARCHITECTURE.md)**
(decisions & rationale) and **[`BUILD-PLAN.md`](BUILD-PLAN.md)** (what gets built, in order).

## Layout

```
apps/
  channel-manager/   First product — the demo and priority sale (V1, active build)
  reservation/       Booking engine + folio + payments (phase 2)
  pms/               Front desk + housekeeping operations (phase 3)
  operator/          Our admin console: all hotels, entitlements, billing, sync health
packages/
  core/              Shared inventory source of truth — domain + availability + rates + restrictions + adapters
  ui/                Design tokens (Atlas palette)
docs/                Spec & architecture (CM developer reference, questionnaire answers, market analysis)
design/              Atlas/Haven/Pulse prototypes + Revio brand
```

Each folder has its own `CLAUDE.md` that narrows scope while inheriting the root context — so every
module knows it belongs to something bigger, without blurring its boundaries.

## What the Channel Manager does

The ARI loop: hold the one true Availability / Rate / Restriction numbers, push them to every connected
OTA, pull bookings back, decrement availability, re-push — so nobody oversells. Nothing else
(no payments, housekeeping, guest profiles, or direct booking — those are CRS/PMS).

## Develop

```bash
pnpm install        # install workspace deps
pnpm test           # run core engine tests (vitest)
pnpm dev            # run the Channel Manager app (added in Phase 2)
```

> Status: **Phase 0 complete** — foundation, shared core (verified), design tokens. Phase 1 (data layer
> + demo seed) is next.
