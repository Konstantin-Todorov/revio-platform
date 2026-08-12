-- Staff invitations and password resets (N2).
--
-- Replaces the arrangement where inviteUser() in all four apps set the SAME hardcoded password
-- ("revio1234") on every account it created, and nothing anywhere could change it. Two consequences
-- worth writing down, because both were live in production until this migration:
--   * every staff account on the platform shared one password, published on the sign-in page;
--   * "reset password" set it back to that same value, so a compromised account could not be recovered.
--
-- Like LoginAttempt, this table is deliberately NOT tenant-scoped and carries NO RLS policy. Both
-- flows run before a session exists — a password reset is by definition requested by someone who
-- cannot sign in, so there is no tenant context to scope to.
--
-- Only the SHA-256 of each emailed token is stored, never the token. A dump of this table yields no
-- working links, which is the entire reason it is a hash column and not a text one.

CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "operatorUserId" TEXT,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- Unique so a hash collision surfaces as a database error rather than as one person's link opening
-- another person's account.
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- Supports "invalidate every outstanding reset for this address" when a new one is requested.
CREATE INDEX "AuthToken_email_purpose_idx" ON "AuthToken"("email", "purpose");

-- Supports pruning.
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");
