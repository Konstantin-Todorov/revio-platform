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

- `src/inventory-claim.ts` — `claimHold()`, the **only** correct way to take inventory. See below.

Rules: apps query through this package (or thin repos here), not with raw SQL scattered in app code.
Inventory/rate/restriction *math* belongs in `@revio/core`; this package stores and retrieves.

## Taking inventory is a claim, never a check followed by a write

`claimHold()` exists because every path that took a room used to do this:

```ts
const remaining = await remainingByNight(...)   // says 1 room left
if (remaining < qty) return "sold out"
await prisma.hold.create(...)                   // ← another request did the same thing here
```

Two guests clicking the last room in the same second both read `remaining = 1`, both passed, and both
got a hold — the exact double-booking this platform exists to prevent. **Never write that shape
again.** Compute the waterfall for the message, then call `claimHold()` for the room.

It works by splitting the waterfall by how fast each input can change. The **sellable base per night**
(physical − out-of-order − closed, or the manual override) is staff-set and slow, so the caller passes
it in from `computeWaterfall`. **Holds and occupying reservations** are the contended half, and are
recounted in SQL inside a `pg_advisory_xact_lock` on the room type — the one place a lock is both
necessary and cheap. The alternative approaches are all ruled out for stated reasons in the file
header; read it before changing this.

Two verification scripts, and **both matter**: `pnpm --filter @revio/db claim-verify` races the
primitive (and first asserts the *old* shape still oversells, so a pass means something), and
`pnpm --filter @revio/booking engine-race` races the real booking-engine path — an atomic claim
called with the wrong sellable base oversells just as happily as no claim at all.

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

Two policies exist, not one. `tenant_isolation` scopes a row to its owner — the hotel is *entitled*
to that data, it just may not see anyone else's. `operator_only` (`ConnectivityCredential` · `Invoice`
· `OperatorUser` · `ClientAccount` · `ClientContact` · `ClientNote`) is stricter: those rows are ours
*about* a hotel — OTA tokens, what we bill them, our renewal risk assessment, the note that the owner
is unhappy — and are visible only under `app.bypass = 'on'`, which only the Operator console sets.
When adding a table, the question is not "does it have a `tenantId`" but "**whose data is this?**"

`src/rls.ts` exposes `forTenant(id)` and `forSystem()`. Choosing between them **is** the security
decision — everything downstream inherits it — so it belongs at the top of a request, not deep in a
data function. The public booking app is the interesting case: it has no session, so `lib/property.ts`
resolves a slug with `forSystem()` and then scopes everything after that to the tenant it returned.
