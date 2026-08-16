-- CreateTable
CREATE TABLE "JobLease" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "JobLease_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "JobLease_expiresAt_idx" ON "JobLease"("expiresAt");


-- ---------------------------------------------------------------------------
-- Access for the restricted runtime role.
--
-- `prisma/rls-role.sql` sets ALTER DEFAULT PRIVILEGES, so a table created by the migration owner
-- SHOULD be granted to revio_app automatically. This restates it explicitly because the failure
-- mode is bad and silent: default privileges only apply to objects created by the role that ran the
-- ALTER, so if a migration is ever applied by a different owner, the app role gets no access and the
-- Channex pull throws on every tick in production while the deploy itself reports success.
--
-- Guarded on the role EXISTING, because a bare GRANT to a missing role aborts the whole migration
-- and this migration ships to a production database, a local dev database, a restored backup and
-- any future preview environment. Only production has been through `rls-role.sql`. A deploy that
-- fails on a fresh database is a worse outcome than a table without a grant on one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "JobLease" TO revio_app;
  END IF;
END
$$;

-- Deliberately NO row-level security policy, and RLS is deliberately NOT enabled on this table.
-- A lease is infrastructure: it is held by a process on behalf of every tenant at once, and it is
-- taken before any tenant context exists. Same reasoning as LoginAttempt and AuthToken.
