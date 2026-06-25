# Revio — Access Model (top to bottom)

How identity, tenancy, products, and roles fit together — so every app (CM now; Operator, CRS, PMS
later) enforces access the same way and nothing leaks. This is the spine; get it right once.

## The two perimeters

```
OPERATOR  (us)                          HOTEL  (a tenant)
─────────────                           ──────────────────
sees ALL tenants                        sees ONLY its own tenant
Operator Console app                    CM / CRS / PMS apps
manages entitlements, billing, keys     uses the products it bought
   │                                        │
   └──────────────  one shared database  ───┘
            isolation enforced top to bottom
```

- **Operator** = the SaaS operator (you). Cross-tenant. Lives in the Operator Console (App 4). Operator
  business data (contracts, billing, OTA tokens) sits in an admin area a hotel can never read.
- **Hotel** = one tenant. Locked to its own `tenantId`. Sees only its data, only the products it bought.

## The single choke point: `getSession()`

Every read and write flows through one function — `apps/*/lib/session.ts` → `getSession()` — which
returns the caller's identity:

```ts
Session = {
  perimeter:   "operator" | "hotel"
  tenantId:    string | null          // null ⇒ operator (all tenants)
  userId:      string
  role:        Role                   // owner | admin | revenue_manager | distribution_manager | read_only
  entitlements:{ channelManager, reservation, pms }   // which products this hotel bought
  activePropertyId: string | null     // the property currently in view
}
```

- Today `getSession()` is a **dev resolver** (active property from a cookie). Real auth (login/SSO)
  replaces **only this function** — nothing downstream changes. That is the whole point of the choke point.
- The data layer (`lib/data.ts`) scopes every query to `session.tenantId` / `activePropertyId`. A hotel
  query can never name another tenant's id because it never has it.

## Four layers of enforcement (defense in depth)

1. **Session** — resolves who you are and which tenant/role/entitlements.
2. **Entitlement gate** — an app refuses to render if the tenant didn't buy it (`channelManager`, …).
3. **Role checks** — sensitive actions (pricing, refunds, user mgmt) are limited by `role`; everything is
   written to the **Audit Log**.
4. **Row-Level Security (DB)** — Postgres policies on every tenant-owned table key off a per-request
   `app.tenant_id`; the database physically refuses cross-tenant rows even if app code has a bug.
   *(RLS migration lands with the switch to Prisma Migrate, just before deploy.)*

## How products are sold separately

Entitlements, not separate code or databases. A hotel with only `channelManager` sees only RevioLink;
buying RevioCRS later flips `reservation = true` and the CRS app lights up on the **same** data — no
migration. The Operator Console flips these.

## Why this makes adding apps flawless

Each new app (Operator, CRS, PMS) is another front-end that calls `getSession()` + the shared core.
- Operator → a session with `perimeter: "operator"` (sees all tenants).
- CRS / PMS → same session spine, gated by their entitlement.
- New roles or permissions → added at the choke point, no app rewrites.
- One database, one migration history, one isolation policy — for every app.

## Proven, not assumed

The seed creates **two** tenants (Hotel Sofia, Black Sea Resort). Switching the active workspace
re-scopes every screen to that tenant — you never see two tenants' data mixed. That is the isolation
guarantee made visible before we deploy.
