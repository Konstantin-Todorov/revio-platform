-- CreateTable
CREATE TABLE "ConnectivityCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectivityCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectivityCredential_tenantId_idx" ON "ConnectivityCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectivityCredential_tenantId_mode_key" ON "ConnectivityCredential"("tenantId", "mode");

-- RLS: connectivity credentials are operator/system-only. NO tenant clause — a hotel-scoped session
-- (app.tenant_id set, no bypass) sees zero rows. Only the bypass perimeter (operator console, and the
-- CM's server-side key resolution via forSystem) can read/write.
ALTER TABLE "ConnectivityCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectivityCredential" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "ConnectivityCredential"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
