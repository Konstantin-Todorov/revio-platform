-- The last table in the database with no row-level security: OperatorUser.
--
-- It was left out of 20260626130000_enable_rls on the reasoning that it is operator-global staff
-- rather than tenant data, so there is no `tenantId` to key a `tenant_isolation` policy on. That is
-- true, and it is the wrong conclusion: "no tenant owns it" is an argument for locking it to the
-- operator perimeter, not for leaving it open.
--
-- It only starts to matter at R3. Until now every service connects as the database owner, so
-- policies are bypassed everywhere and this table is no more exposed than any other. The moment the
-- hotel-facing apps connect as the restricted `revio_app` role, every other table stops answering
-- them without a tenant context — and this one would keep answering, from the same connection, with
-- the platform administrators' email addresses and bcrypt hashes. RLS exists precisely for the case
-- where application code has a bug; the table holding the credentials that can see every hotel is
-- the last one that should be relying on there being no bug.
--
-- `operator_only` is the same policy ConnectivityCredential and Invoice already carry: visible only
-- under `app.bypass = 'on'`. The Operator console reaches the database exclusively through
-- `forSystem()` (login, session, settings, billing — see apps/operator/lib/*), so it is unaffected;
-- the seed sets the same GUC. A hotel-perimeter connection now gets zero rows instead of all of them.

ALTER TABLE "OperatorUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorUser" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "OperatorUser";
CREATE POLICY operator_only ON "OperatorUser"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
