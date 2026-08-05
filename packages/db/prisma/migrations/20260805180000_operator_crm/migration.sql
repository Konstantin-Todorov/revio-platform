-- Operator CRM (L6): the relationship half of a client record.
--
-- The console can already say which customer to call and what to sell them. It has never been able to
-- say WHO to call, WHEN the contract renews, or WHAT WAS SAID LAST TIME — the three things that
-- actually happen on the call. Those live here.
--
-- All three tables carry `operator_only`, the strictest policy in the database: rows are visible only
-- under `app.bypass = 'on'`, which only the Operator console's `forSystem()` connection ever sets.
-- This is stricter than `tenant_isolation` on purpose. Tenant-isolated data is the hotel's own and
-- they are entitled to it; this is our private assessment OF them — a renewal risk, a note that the
-- owner is unhappy, a phone number for the person we would call to save the account. A bug in a
-- hotel-facing app must not be able to surface a word of it, so the database refuses rather than the
-- application remembering to.

-- CreateTable
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'onboarding',
    "ownerOperatorId" TEXT,
    "renewalDate" DATE,
    "contractTermMonths" INTEGER,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isBilling" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAccount_tenantId_key" ON "ClientAccount"("tenantId");

-- CreateIndex
CREATE INDEX "ClientContact_tenantId_idx" ON "ClientContact"("tenantId");

-- CreateIndex
CREATE INDEX "ClientNote_tenantId_occurredAt_idx" ON "ClientNote"("tenantId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull, not Cascade: an operator leaving the company must not delete the client's history with us.
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_ownerOperatorId_fkey" FOREIGN KEY ("ownerOperatorId") REFERENCES "OperatorUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: operator-only (bypass). Same pattern as Invoice / ConnectivityCredential / OperatorUser.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ClientAccount', 'ClientContact', 'ClientNote']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS operator_only ON %I', t);
    EXECUTE format($p$CREATE POLICY operator_only ON %I
      USING (current_setting('app.bypass', true) = 'on')
      WITH CHECK (current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
