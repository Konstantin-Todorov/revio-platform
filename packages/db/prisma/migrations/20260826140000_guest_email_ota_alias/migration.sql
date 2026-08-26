-- An OTA forwarding address is not the guest's own address. Flagged when learned so no screen
-- presents it as identity and it never reaches a marketing list.
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "emailIsOtaAlias" BOOLEAN NOT NULL DEFAULT false;
