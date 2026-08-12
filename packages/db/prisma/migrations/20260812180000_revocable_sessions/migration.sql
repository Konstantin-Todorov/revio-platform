-- Revocable sessions (N3).
--
-- Sessions are stateless JWTs, so nothing could end one early. Two additions fix that without a
-- session table: a per-account cutoff compared against the token's own `iat`, and — for operator
-- staff — the `active` flag every hotel user already had.
--
-- Both are nullable / defaulted, so every session alive at deploy time stays alive. Revocation is
-- opt-in from the moment somebody changes a password or signs out everywhere.

ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);

ALTER TABLE "OperatorUser" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OperatorUser" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
