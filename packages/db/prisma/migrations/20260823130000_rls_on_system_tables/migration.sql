-- Close the last three tables with no row-level security at all.
--
-- `rls-verify` asserts that EVERY table in the database has RLS enabled, and it has been failing on
-- these three since they were added — the gate was red and nobody was reading it. They have no
-- `tenantId`, so `tenant_isolation` never applied to them and they were simply left open: any
-- connection with table grants could read every row. That connection is `revio_app`, which is the
-- role all five apps use, so a hotel-facing request could read every password-reset token row and
-- the whole login-attempt history.
--
-- They are system tables, not tenant tables, so the right policy is the existing `operator_only`
-- shape: readable and writable only under `app.bypass = 'on'`. Verified safe before writing this —
-- login-gate.ts, auth-tokens.ts, auth-flows.ts and job-lease.ts reach these tables exclusively
-- through `forSystem()`, which is the bypass perimeter. Nothing hotel-scoped touches them.
--
--   LoginAttempt — the brute-force gate; runs before any session exists, so it cannot be scoped.
--   AuthToken    — password-reset and invite tokens; same, by definition.
--   JobLease     — cron/worker leases; platform-level, owned by no tenant.

ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginAttempt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "LoginAttempt";
CREATE POLICY operator_only ON "LoginAttempt"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');

ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "AuthToken";
CREATE POLICY operator_only ON "AuthToken"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');

ALTER TABLE "JobLease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobLease" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "JobLease";
CREATE POLICY operator_only ON "JobLease"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
