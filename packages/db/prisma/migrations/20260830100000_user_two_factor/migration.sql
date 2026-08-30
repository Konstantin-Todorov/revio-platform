-- Two-factor for hotel staff accounts, on the shared identity: enrolling once in RevioCRS protects
-- the same person in RevioLink and RevioPMS. Three per-app secrets would be three chances to leave
-- one unprotected, and the account is one person either way.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpLastStep"  INTEGER;

CREATE TABLE "UserRecoveryCode" (
  "id"       TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt"   TIMESTAMP(3),
  CONSTRAINT "UserRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserRecoveryCode_userId_idx" ON "UserRecoveryCode"("userId");
ALTER TABLE "UserRecoveryCode"
  ADD CONSTRAINT "UserRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A recovery code belongs to a hotel's own user, so it follows that user's tenant. Resolved through
-- the User row rather than a duplicated tenantId column: one owner of the truth, and no way for the
-- two to disagree about who a code belongs to.
ALTER TABLE "UserRecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRecoveryCode" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UserRecoveryCode"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "UserRecoveryCode"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "UserRecoveryCode"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  );
