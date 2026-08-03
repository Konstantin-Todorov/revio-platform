# Revio — Hotel Software Platform

A composable line of hotel software — **Channel Manager**, **Reservation/CRS**, **PMS**, and the
hotel's own **booking page** — sharing one inventory core, sold separately, run by one operator over
many hotels.

> **Live:** RevioLink (CM) → https://channel-manager-production-59bb.up.railway.app ·
> RevioCRS → https://reservation-production-f8c5.up.railway.app ·
> RevioPMS → https://pms-production-a64b.up.railway.app ·
> Operator Console → https://operator-production-5eed.up.railway.app
> · **Repo:** https://github.com/Konstantin-Todorov/revio-platform · pushes to `main` auto-deploy on Railway.
> See [`DEPLOY.md`](DEPLOY.md).

Start with **[`CLAUDE.md`](CLAUDE.md)** (the big picture), then **[`ARCHITECTURE.md`](ARCHITECTURE.md)**
(decisions & rationale) and **[`BUILD-PLAN.md`](BUILD-PLAN.md)** (what gets built, in order).

## Layout

```
apps/
  channel-manager/   RevioLink — ARI sync with the OTAs. First product, the priority sale.   :3000
  operator/          Our admin console: all hotels, entitlements, billing, sync health       :3001
  reservation/       RevioCRS — reservations, rates, guests, analytics                       :3002
  pms/               RevioPMS — front desk, housekeeping, folios, invoicing                  :3003
  booking/           RevioDirect — the hotel's public booking page (live)                    :3004
packages/
  core/              Shared inventory source of truth — domain + availability + rates + restrictions + adapters
  db/                Prisma schema, client, RLS perimeters, demo seed
  connectivity/      Channex adapter + the shared push/pull orchestration
  booking/           Guest-facing domain — availability, quoting, holds, slugs, abuse limits
  email/             Templates → transport (Resend when configured, a log line when not)
  payments/          The only path to a card. Mock-first; Stripe TEST keys only, never live.
  storage/           Uploaded media — local disk or any S3-compatible bucket
  ui/                Design tokens (Atlas palette)
docs/                Spec & architecture (founder specs in docs/specs/, developer reference, market analysis)
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
pnpm test           # every package's tests (vitest)
pnpm typecheck      # tsc --noEmit across the workspace
pnpm dev            # RevioLink on :3000
```

Any other app:

```bash
pnpm --filter @revio/booking-app dev
```

(`@revio/channel-manager` · `@revio/operator` · `@revio/reservation` · `@revio/pms` · `@revio/booking-app`.)

Demo logins use password `revio1234` — `admin@hotelsofia.demo` for a hotel, `operator@revio.app` for
the operator console.

> **Status.** All four staff products are built, tested and live behind login. **RevioDirect** (the
> guest-facing booking page) is in build — a guest can complete a booking end to end locally, and it
> is not deployed yet. Current detail is in [`CLAUDE.md`](CLAUDE.md) → Status; what's next is at the
> top of [`BUILD-PLAN.md`](BUILD-PLAN.md).
