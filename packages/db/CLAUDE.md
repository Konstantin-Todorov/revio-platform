# Package: DB (`@revio/db`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first.

The **persistence layer**: Prisma schema, client, and the demo seed. It imports types/engines from
`@revio/core` but `@revio/core` never imports this — domain logic stays pure and DB-free.

- `prisma/schema.prisma` — the tables. Every tenant-owned row carries `tenantId`. RLS policies are
  added as raw-SQL migrations (Postgres enforces tenant isolation even if app code has a bug).
- `prisma/seed.ts` — seeds the **demo**: Hotel Sofia, 6 room types, 7 rate plans (Standard manual;
  Non-Refundable/Breakfast/Trip.com/etc. derived via `@revio/core`), 4 channels + mappings, a rolling
  calendar whose **current week reproduces the reference screenshot**, reservations, sync/error/audit rows.
- `src/client.ts` — the shared `PrismaClient` singleton.

Rules: apps query through this package (or thin repos here), not with raw SQL scattered in app code.
Inventory/rate/restriction *math* belongs in `@revio/core`; this package stores and retrieves.

## Two things that must never end up in a column

Both are cheap to add by accident and expensive to undo, so they are stated here rather than left to
be re-derived at the call site.

- **No card numbers. Ever.** `Reservation.guarantee*` holds a gateway *token* plus brand and last4 —
  enough to charge a no-show, useless to a thief, and outside PCI scope. A PAN, CVV or expiry in this
  database would change what the company is legally required to do. All card handling goes through
  `@revio/payments`.
- **No image bytes.** `RoomTypePhoto` and `BrandAsset` store *keys*; the bytes live in object storage
  via `@revio/storage`. A 5 GB row store costs an order of magnitude more per GB than a bucket, bloats
  every backup and restore, and routes every image request through our app server. The email logo is
  the one legacy exception, and it is small and singular.

## Perimeters

`src/rls.ts` exposes `forTenant(id)` and `forSystem()`. Choosing between them **is** the security
decision — everything downstream inherits it — so it belongs at the top of a request, not deep in a
data function. The public booking app is the interesting case: it has no session, so `lib/property.ts`
resolves a slug with `forSystem()` and then scopes everything after that to the tenant it returned.
