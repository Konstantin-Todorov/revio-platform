-- Whether a stored Channex key actually works.
--
-- The operator console stored whatever was pasted and never exercised it. On 2026-09-01 that meant a
-- revoked key sat in this table looking identical to a working one while the first real hotel's
-- channel silently did nothing for hours — and the Sync Center, reading a 401 as an empty feed,
-- reported success 411 times in a row.
--
-- A credential nobody has exercised is not a credential, it is a hope. These three columns are the
-- record of the last time somebody asked Channex.
--
-- All nullable, and `lastCheckOk = NULL` means NEVER TESTED — which is not the same as working, and
-- the screen must never colour it green.
ALTER TABLE "ConnectivityCredential" ADD COLUMN "lastCheckedAt"    TIMESTAMP(3);
ALTER TABLE "ConnectivityCredential" ADD COLUMN "lastCheckOk"      BOOLEAN;
ALTER TABLE "ConnectivityCredential" ADD COLUMN "lastCheckMessage" TEXT;
