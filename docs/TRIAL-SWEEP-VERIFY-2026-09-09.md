# Trial sweep — PostgreSQL verification (2026-09-09)

## Result

The trial sweep now has an opt-in end-to-end test against a migrated disposable PostgreSQL 16.14
database, through a login role that is neither superuser nor `BYPASSRLS`. It runs the real
`sweepTrials` function over real `Tenant`, `User` and `ProductTrial` rows.

The first run found two runtime defects. Both are fixed and covered by regression tests:

1. A trial that missed its 7-day reminder correctly received the 1-day reminder, but the next sweep
   then sent the stale “7 days left” message. The shared pure rule now selects the most urgent reached
   threshold first and never falls back to an older warning after that threshold was recorded.
2. Expiry closed the trial and revoked the entitlement in two separate transactions. If the second
   write failed, the closed trial was never selected again and access stayed on indefinitely. Both
   writes now use one `withSystemTransaction`; a real PostgreSQL trigger-induced failure proves that
   everything rolls back and the next sweep retries cleanly.

## What the database test proves

- 8 days remaining: no reminder.
- 7 days remaining: one 7-day reminder; the same sweep time again sends none.
- 1 day remaining: one 1-day reminder whether or not the 7-day reminder was sent; a repeat sends none.
- Expiry writes `endedAt` and `outcome = "expired"`.
- Expiry revokes only the product being trialled, on only that tenant.
- A second sweep changes nothing already completed.
- The SQL-only partial unique index refuses a second running trial for the same tenant and product,
  while a new trial is allowed after the first one ends.
- An entitlement-write failure rolls back the trial close, preserves access, and leaves a clean retry.

## Command and result

```text
TRIAL_SWEEP_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/trial_sweep_verify_utf8 \
DATABASE_URL=<same> DIRECT_DATABASE_URL=<same> \
pnpm --filter @revio/operator test -- lib/trial-sweep-db.test.ts

4 tests passed
```

The pure trial rules also pass 22 unit tests, and both `@revio/core` and `@revio/operator` pass
typecheck. The database suite is opt-in and refuses every hostname/database name except the named
loopback disposable database.
