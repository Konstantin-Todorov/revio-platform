-- Two things, and they belong in one migration because they are the same decision seen twice:
-- what we are allowed to charge, and what we are able to collect.

-- 1. Our own integration credentials, entered through the operator console.
--
-- Not ConnectivityCredential: that is per tenant and holds a hotel's own Channex key. This is the
-- platform's own, at most one row per provider and mode.
CREATE TABLE "PlatformCredential" (
  "id"               TEXT NOT NULL,
  "provider"         TEXT NOT NULL,
  "mode"             TEXT NOT NULL,
  "cipher"           TEXT NOT NULL,
  "hint"             TEXT NOT NULL,
  "publishableKey"   TEXT,
  "webhookCipher"    TEXT,
  "lastCheckedAt"    TIMESTAMP(3),
  "lastCheckOk"      BOOLEAN,
  "lastCheckMessage" TEXT,
  "lastCheckDetail"  JSONB,
  "updatedBy"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformCredential_pkey" PRIMARY KEY ("id")
);

-- One credential per provider per mode. Test and live coexist deliberately: switching modes must not
-- destroy the key you are switching away from, or a mistaken switch is unrecoverable.
CREATE UNIQUE INDEX "PlatformCredential_provider_mode_key" ON "PlatformCredential"("provider", "mode");

-- Operator-perimeter, and stricter than tenant isolation on purpose. Tenant-isolated data is the
-- hotel's own and they are entitled to it; this is OUR payment credential and no hotel session may
-- reach it under any circumstances. No tenant clause — only the bypass perimeter reads or writes.
ALTER TABLE "PlatformCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformCredential" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "PlatformCredential"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');

-- 2. WHICH VAT registration we hold.
--
-- Until now this was inferred: a VAT number present meant "charge the domestic rate". Bulgaria has a
-- third state between "not registered" and "registered", and it is the one we are actually in —
-- чл. 97а ЗДДС gives a real BG number that is valid ONLY for cross-border services. Under it we may
-- not state VAT on a domestic invoice at all (чл. 113, ал. 9) and cannot deduct input VAT
-- (чл. 70, ал. 4). Collapsing it into "registered" put 20% on every Bulgarian invoice.
ALTER TABLE "OperatorCompany" ADD COLUMN "vatRegistration" TEXT NOT NULL DEFAULT 'none';

-- Backfill to the state the founder confirmed on 2026-09-09: a BG number held for supplies outside
-- Bulgaria only.
--
-- Deliberately the CAUTIOUS direction. If this guess is wrong it under-charges, which is a correction
-- we make before issuing; the opposite guess collects 20% from a Bulgarian customer that we are
-- prohibited from stating, which is not a correction but a refund and an explanation. Zero invoices
-- have been issued to a real client, so nothing already sent depends on either reading, and the
-- console makes this one click to change.
UPDATE "OperatorCompany" SET "vatRegistration" = 'art97a' WHERE "vatId" IS NOT NULL;
