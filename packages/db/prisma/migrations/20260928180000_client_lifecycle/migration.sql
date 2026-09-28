-- Client lifecycle: type, billing mode and status history (founder, 2026-09-28).
ALTER TABLE "Tenant" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "Tenant" ADD COLUMN "billingMode" TEXT NOT NULL DEFAULT 'paying';
ALTER TABLE "Tenant" ADD COLUMN "freeUntil" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "billingNote" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "closedAt" TIMESTAMP(3);

-- Existing demo tenants become type demo and are not billed unless somebody chooses to.
UPDATE "Tenant" SET "accountType" = 'demo', "billingMode" = 'none' WHERE "isDemo" = true;

CREATE TABLE "ClientEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "reason" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientEvent_tenantId_at_idx" ON "ClientEvent"("tenantId", "at");
ALTER TABLE "ClientEvent" ADD CONSTRAINT "ClientEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: operator-only (bypass). A hotel must never read our record of what we did to its account.
ALTER TABLE "ClientEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "ClientEvent";
CREATE POLICY operator_only ON "ClientEvent"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
