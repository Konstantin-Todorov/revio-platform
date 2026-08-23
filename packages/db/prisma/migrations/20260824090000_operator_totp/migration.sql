-- Two-factor authentication for the Operator console (N4).
--
-- The console reads every hotel's data and holds their OTA credentials, so a single guessed or
-- reused password there reaches the whole platform. It is the one account set where a second factor
-- is worth the friction, and the smallest — a handful of people — so the friction costs almost
-- nothing.
--
-- Additive and off by default: existing operators sign in exactly as before until they enrol.

-- The shared secret, encrypted at rest with the same AES-256-GCM helper the OTA credentials use.
ALTER TABLE "OperatorUser" ADD COLUMN "totpSecret" TEXT;
-- Null until a code has been verified. Enrolment stores the secret first and only turns 2FA on once
-- the person has proved their app produces matching codes; otherwise a mistyped setup locks them
-- out of the console permanently.
ALTER TABLE "OperatorUser" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
-- The last accepted 30-second step. Without it a code stays usable for the rest of its window, and
-- TOTP is only single-use if something remembers that it was used.
ALTER TABLE "OperatorUser" ADD COLUMN "totpLastStep" INTEGER;

-- Recovery codes: the way back in when the phone is gone. Hashed like passwords, because a leaked
-- one bypasses the second factor entirely. Used ones are kept, not deleted — "used at this time" is
-- the audit answer to "how did they sign in without the app".
CREATE TABLE "OperatorRecoveryCode" (
  "id"             TEXT NOT NULL,
  "operatorUserId" TEXT NOT NULL,
  "codeHash"       TEXT NOT NULL,
  "usedAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperatorRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperatorRecoveryCode_operatorUserId_idx" ON "OperatorRecoveryCode"("operatorUserId");
ALTER TABLE "OperatorRecoveryCode"
  ADD CONSTRAINT "OperatorRecoveryCode_operatorUserId_fkey"
  FOREIGN KEY ("operatorUserId") REFERENCES "OperatorUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Operator-perimeter, like every other row that is OURS about the business rather than a hotel's
-- own data. `rls-verify` asserts every table has RLS enabled, so a new table without a policy would
-- fail the gate — and a recovery-code table readable by a hotel connection would be a live bypass.
ALTER TABLE "OperatorRecoveryCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorRecoveryCode" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "OperatorRecoveryCode";
CREATE POLICY operator_only ON "OperatorRecoveryCode"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
