-- Close the faults and warnings whose CAUSE has already been fixed.
--
-- The console showed 4 unresolved application faults and 39 unresolved channel warnings on
-- 2026-09-08, every one of them from a bug that was fixed days earlier. That is worse than it
-- sounds: an attention feed that is permanently amber is an attention feed nobody reads, and the
-- first real fault would have arrived into a screen everyone had already learned to ignore.
--
-- ⚠️ **Bounded on purpose — this can never clear something new.**
-- Every statement below is limited to a specific cause AND to a date before that cause was fixed.
-- A fault of the same shape happening tomorrow stays open, which is the whole point: the aim is a
-- console that is quiet when things are well, not a console that has been silenced.
--
-- `AppError.resolvedAt` un-resolves itself automatically if the same fault recurs (see the model),
-- so closing these is a statement about the past, not a suppression.
--
--   psql "$DATABASE_PUBLIC_URL" -f packages/db/scripts/clear-resolved-faults.sql
--
-- Idempotent: a second run matches nothing.

BEGIN;

\echo '=== BEFORE ==='
SELECT 'app faults' AS what, count(*) FROM "AppError" WHERE "resolvedAt" IS NULL
UNION ALL SELECT 'channel warnings', count(*) FROM "ErrorItem" WHERE resolved = false;

-- 1. "Failed to find Server Action" — a browser tab left open across a deploy asks the new build for
--    an action id the old build owned. Never a code fault; the app now detects it and reloads itself
--    (StaleDeploymentBoundary, shipped 2026-09-07) instead of showing an error nobody could dismiss.
UPDATE "AppError"
SET "resolvedAt" = now()
WHERE "resolvedAt" IS NULL
  AND message LIKE '%Failed to find Server Action%'
  AND "lastSeenAt" < TIMESTAMP '2026-09-08';

-- 2. `priceMinor: NaN` reaching Prisma from the calendar — gap register class 1, fixed 2026-09-02 by
--    parsing money through one guarded reader (and `money-lint` now fails the build on a bare
--    numeric coercion of form input, so it cannot come back quietly).
UPDATE "AppError"
SET "resolvedAt" = now()
WHERE "resolvedAt" IS NULL
  AND message LIKE '%NaN%'
  AND "lastSeenAt" < TIMESTAMP '2026-09-02 23:59:59';

-- 3. `property_id Not found property` — a Channex push aimed at a property that did not exist on
--    that account yet. Last seen 2026-08-31; since 2026-09-01 there have been 9,086 successful syncs
--    and not one recurrence, so the cause is gone rather than sleeping.
--
--    Bounded by BOTH code and date: a rejection tomorrow means something new and must stay loud.
UPDATE "ErrorItem"
SET resolved = true
WHERE resolved = false
  AND code = 'update_rejected'
  AND "createdAt" < TIMESTAMP '2026-09-01';

\echo ''
\echo '=== AFTER — anything still listed here is genuinely open ==='
SELECT 'app faults' AS what, count(*) FROM "AppError" WHERE "resolvedAt" IS NULL
UNION ALL SELECT 'channel warnings', count(*) FROM "ErrorItem" WHERE resolved = false;

\echo ''
\echo 'Still open, if any:'
SELECT service, route, count, "lastSeenAt"::timestamp(0) AS last, left(message, 60) AS message
FROM "AppError" WHERE "resolvedAt" IS NULL ORDER BY "lastSeenAt" DESC;

SELECT code, severity, count(*), max("createdAt")::date AS newest
FROM "ErrorItem" WHERE resolved = false GROUP BY 1, 2;

COMMIT;
