# Revio — Access Model (top to bottom)

How identity, tenancy, products, and roles fit together — so every app enforces access the same way and
nothing leaks. This is the spine; get it right once. All four staff apps now run on it, and the public
booking page is the one deliberate exception (below).

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

### A third perimeter: **public** (RevioDirect, 2026-07-27)

The booking page has **no session and therefore no tenant context** — the inversion of everything
above. It cannot ask "who are you?" and derive a tenant; it has to resolve one from a URL slug and then
scope itself.

```
PUBLIC  (a guest, no account)
────────────────────────────
apps/booking · one slug → one property → that property's tenant, and nothing else
```

Three rules follow, and they are enforced in `apps/booking/lib/property.ts`, the single choke point:

1. **The slug lookup runs on the system perimeter** — deliberately, because there is no tenant yet to
   scope to. It is the *only* unscoped read, it resolves exactly one property, and everything
   downstream uses the tenant it returned.
2. **Every "no" is identical.** Unknown slug, engine switched off, suspended tenant, inactive property
   → one generic 404. Distinguishing them leaks which hotels are Revio customers and which stopped
   paying.
3. **Abuse protection is part of the perimeter, not hardening.** An unauthenticated endpoint that
   consumes inventory needs limits before it ships, per-IP *and* per-property.

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

- ~~Today `getSession()` is a **dev resolver**.~~ **Real auth shipped** — email + password (bcryptjs)
  and a signed JWT cookie (jose), per app. Exactly as designed, **only this function changed**;
  nothing downstream did. That is the whole point of the choke point, and it is now demonstrated
  rather than claimed.
- The data layer (`lib/data.ts`) scopes every query to `session.tenantId` / `activePropertyId`. A hotel
  query can never name another tenant's id because it never has it.

## Four layers of enforcement (defense in depth)

1. **Session** — resolves who you are and which tenant/role/entitlements.
2. **Entitlement gate** — an app refuses to render if the tenant didn't buy it (`channelManager`, …).
3. **Role checks** — sensitive actions (pricing, refunds, user mgmt) are limited by `role`; everything is
   written to the **Audit Log**.
4. **Row-Level Security (DB)** — Postgres policies on every tenant-owned table key off a per-request
   `app.tenant_id`; the database physically refuses cross-tenant rows even if app code has a bug.
   **Built and verified locally.** ⚠️ **On production the policies are inert**, because RLS does not
   apply to a superuser and prod still connects as one. Switching to the restricted `revio_app` role
   is RLS Phase 2 (`DEPLOY.md`, task R3) — until then layers 1–3 are the real enforcement and layer 4
   is correct but not yet load-bearing. Don't count it twice.

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
