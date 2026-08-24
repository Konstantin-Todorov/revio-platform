-- The authentication audit trail (N5).
--
-- `LoginAttempt` is a rate-limiting counter and `recordLoginSuccess` deletes the row, so a
-- successful sign-in has never left a trace. A platform that records who moved a guest between
-- rooms but not who signed into the account that did it is answering the second question with
-- nothing — and "who logged in at 3am" is the question asked after something goes wrong.
--
-- Separate from AuditEntry on purpose: that is what somebody did to a hotel's DATA, this is what
-- happened to an ACCOUNT. Different readers, different retention, and a failed sign-in belongs to no
-- tenant at all.
CREATE TABLE "AuthEvent" (
  "id"             TEXT NOT NULL,
  "scope"          TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "userId"         TEXT,
  "operatorUserId" TEXT,
  "tenantId"       TEXT,
  "email"          TEXT,
  "ip"             TEXT,
  "userAgent"      TEXT,
  "detail"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthEvent_tenantId_createdAt_idx" ON "AuthEvent"("tenantId", "createdAt");
CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt");
CREATE INDEX "AuthEvent_operatorUserId_createdAt_idx" ON "AuthEvent"("operatorUserId", "createdAt");
CREATE INDEX "AuthEvent_scope_type_createdAt_idx" ON "AuthEvent"("scope", "type", "createdAt");

-- No foreign keys, deliberately. The most valuable rows are the ones that reference nothing — a
-- failed attempt against an address that is not an account — and a cascade on user deletion would
-- erase precisely the history somebody would want after removing an account.

-- RLS: a hotel may read its OWN staff's events; everything else is ours. Rows with a NULL tenantId
-- (operator sign-ins, failures against an unknown address) are reachable only under bypass, so a
-- hotel connection cannot enumerate who else has an account on the platform.
ALTER TABLE "AuthEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuthEvent";
CREATE POLICY tenant_isolation ON "AuthEvent"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.tenant_id', true))
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR ("tenantId" IS NOT NULL AND "tenantId" = current_setting('app.tenant_id', true))
  );
