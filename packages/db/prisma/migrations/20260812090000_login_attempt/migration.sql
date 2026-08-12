-- Brute-force protection for the login forms (N1).
--
-- Until now every Revio sign-in page accepted unlimited password attempts. bcrypt makes each guess
-- cost ~100ms, which slows an attacker and does not stop one: a single machine still gets roughly
-- 864,000 guesses a day against the operator console, and the operator console sees every tenant.
--
-- Two deliberate departures from every other table in this database:
--
-- 1. NO tenant_id, and NO RLS POLICY. A login attempt happens BEFORE any tenant context exists —
--    there is no session, no `app.tenant_id` GUC to set, and frequently no account. A tenant_isolation
--    policy here would make the table unreadable at exactly the moment it must be read, and the row
--    contains nothing a tenant owns: an email someone typed, and a count.
--
-- 2. `identifier` is NOT a foreign key to "User". Attempts are recorded against the email as typed
--    whether or not it matches an account, because locking only real accounts turns the lockout
--    message into an account-existence oracle — type an address, see whether it can be locked, learn
--    who has an account here.
--
-- The thresholds and backoff live in @revio/core (auth/login-gate.ts, 21 tests); this table is only
-- that function's memory between requests. Storing it in Postgres rather than in process memory is
-- what makes the lockout survive a deploy — otherwise `git push` becomes a way to clear it.

CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockouts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- One row per (app, email). The upsert on every failed attempt depends on this being unique.
CREATE UNIQUE INDEX "LoginAttempt_scope_identifier_key" ON "LoginAttempt"("scope", "identifier");

-- Supports pruning rows that have long since decayed, so a spray across thousands of invented
-- addresses cannot grow this table without bound.
CREATE INDEX "LoginAttempt_updatedAt_idx" ON "LoginAttempt"("updatedAt");
