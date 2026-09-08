-- Keep a two-factor setup in progress apart from the factor that already works.
--
-- Until now one column held both. `beginEnrolment` wrote `totpEnabledAt: null` to make room for a
-- new secret — so merely STARTING setup turned 2FA off, reachable from a session alone, while the
-- dedicated disable action requires the password precisely because an unattended laptop must not be
-- enough. Abandon the setup and the account was left with no second factor and nobody told.
--
-- Found by an external review on 2026-09-08 (R2).
ALTER TABLE "User" ADD COLUMN "totpPendingSecret" TEXT;
ALTER TABLE "OperatorUser" ADD COLUMN "totpPendingSecret" TEXT;
