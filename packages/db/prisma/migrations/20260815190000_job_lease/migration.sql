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
-- GRANT is idempotent, so restating it costs nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON "JobLease" TO revio_app;

-- Deliberately NO row-level security policy, and RLS is deliberately NOT enabled on this table.
-- A lease is infrastructure: it is held by a process on behalf of every tenant at once, and it is
-- taken before any tenant context exists. Same reasoning as LoginAttempt and AuthToken.
