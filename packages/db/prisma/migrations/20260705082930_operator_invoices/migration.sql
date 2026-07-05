-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lineItems" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_period_key" ON "Invoice"("tenantId", "period");

-- RLS: operator-only (bypass) — hotels can never read billing. Same pattern as ConnectivityCredential.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Invoice']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS operator_only ON %I', t);
    EXECUTE format($p$CREATE POLICY operator_only ON %I
      USING (current_setting('app.bypass', true) = 'on')
      WITH CHECK (current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
