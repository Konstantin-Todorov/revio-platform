# Revio — Architecture & Decisions

The "why" behind the structure. Decisions confirmed with the founder are marked ✅.

## Decisions locked

| # | Decision | Choice |
| - | -------- | ------ |
| 1 | Code structure | ✅ **One monorepo, modular monolith, one shared core** (not three separate repos) |
| 2 | Backend language | ✅ **TypeScript end-to-end** (Node API + React/Next, shared types in `packages/core`) |
| 3 | First deliverable | ✅ **Channel Manager demo** on seeded data, matching the reference screenshot |
| 4 | Multi-tenancy | Shared Postgres + **Row-Level Security**; `tenant_id` on every tenant row |
| 5 | Selling separately | **Entitlements** per hotel account — not code separation |
| 6 | Connectivity | One `ChannelAdapter` interface; **mock adapter for the demo**, real OTA/Channex later |
| 7 | Deployment | **Railway**: Postgres + Redis + one Next app (API in route handlers) for the demo |

## Why one monorepo, not three products

The three products fight over the **same single number**: rooms available on a date. That number is the
source of truth, and the Channel Manager's entire job is to stop two guests booking the same room. If
CM, CRS, and PMS were three separate systems with three databases, we'd have to sync inventory between
our **own** products in real time — recreating the double-booking problem inside the platform. So we
keep one core and one database, and make the products independently *sellable* through entitlements.

This is the **composable / best-of-breed** model (Apaleo is the closest market example), as opposed to
the locked all-in-one suites (Mews, Cloudbeds, RoomRaccoon). It lets us land a hotel with just the
Channel Manager and expand into CRS/PMS later with zero re-onboarding — our main commercial edge.

## The shape

```
ONE database (Postgres + RLS)
        │
   packages/core  ── the shared inventory source of truth
        │  domain types · availability · derived rates · restrictions · channel adapters
        │
   ┌────┼─────────────┬──────────────┬───────────────┐
  CM   CRS           PMS          Operator        (four apps on the same core)
 (V1)  (phase 2)   (phase 3)    (thin now)
```

- **Apps never touch inventory directly** — only through `@revio/core`. Apps never import each other.
- **Two access perimeters:** Operator (all hotels) vs Hotel (its own data + purchased modules only).
  Operator business data (contracts, billing, OTA tokens) lives in an admin schema hotels can't read.
- **Modular monolith, not microservices.** Clear module boundaries now; split into services only when a
  real scaling need appears. Domain logic is pure in `packages/core`, so extraction later is mechanical.

## The three engines (already implemented in `packages/core`, verified)

1. **Availability** (V2 model, 2026-06-27) = **date-level inventory − rooms sold**, where "rooms to sell"
   is a per-date allotment the hotel manages (defaulting to the room type's physical `totalRooms`) and
   "rooms sold" is always *derived* from confirmed reservations. Stop Sell is a *separate flag* (0 bookable
   without changing the count). This is the seed of the **CRS availability waterfall**
   (Physical − Out-of-order − Closed − Holds − Confirmed) — the same function in `@revio/core` grows to the
   full form when RevioCRS lands; never a second copy. (See `docs/CRS-REFERENCE.md`, `docs/CM-REVISIONS.md`.)
2. **Derived rates** — a rate plan's price computed from a parent (±%/±fixed, rounding, floor, ceiling);
   recalculates when the parent changes unless a date was manually overridden.
3. **Restriction priority** — manual edit / Bulk Update > Restriction Rule > Rate Plan default
   > Property default (the CRS adds the property-level fallback).

## Two adapter boundaries (the same pattern, twice)
- **CM ↔ OTA** — `ChannelAdapter` (`@revio/connectivity`: Mock | Channex | …). Built + sandbox-verified.
- **CRS ↔ Channel Manager** — a future `ChannelManagerConnector` with **RevioLink-internal** (shared
  core/DB, no network) and **third-party** (real push/pull) impls. The CRS connects to exactly one CM and
  can't tell internal from external — exactly the spec's requirement. Reservations are the CRS's system of
  record; when CM + CRS are both on, they share one reservation table that grows additively.

## Tech stack

- **TypeScript** everywhere; pnpm workspaces; Node ≥ 20.
- **Next.js (App Router)** apps. For the demo the API is Next route handlers calling `@revio/core`.
- **Postgres + Prisma** with RLS. **Redis + BullMQ** for the sync queue (in-process for the demo).
- **Tailwind** + `@revio/ui` tokens (Atlas palette).

## Railway topology (demo)

```
Postgres (managed)  ·  Redis (managed)  ·  web: Next.js app (CM, +thin Operator)
```

API extracts to its own Railway service later without touching domain logic, because all domain logic
already lives in `packages/core`.

## Risks we are designing around (from the architecture analysis)

- **Double-booking** → transactional, computed availability + reconciliation.
- **OTA access timelines** (Airbnb invite-only, Booking waitlists) → adapter abstraction; mock now,
  aggregator (Channex) and direct connections behind the same interface later.
- **Silent sync failures** → visible Sync Center status, Error Center, retry queue.
- **Guest data & payments** → separate guest domain + PSP tokenization (never store card data) — a
  CRS/PMS-phase concern, but the boundary is set now.
- **Premature complexity** → modular monolith, not early microservices.
