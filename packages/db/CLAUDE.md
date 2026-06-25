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
