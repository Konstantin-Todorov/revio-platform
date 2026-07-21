-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "mergedIntoId" TEXT;

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" TIMESTAMP(3),
    "clockedInById" TEXT,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "unitId" TEXT,
    "userId" TEXT,
    "actorId" TEXT,
    "fromState" TEXT,
    "toState" TEXT,
    "refId" TEXT,
    "meta" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffShift_propertyId_clockOutAt_idx" ON "StaffShift"("propertyId", "clockOutAt");

-- CreateIndex
CREATE INDEX "StaffShift_userId_clockInAt_idx" ON "StaffShift"("userId", "clockInAt");

-- CreateIndex
CREATE INDEX "OpsEvent_propertyId_at_idx" ON "OpsEvent"("propertyId", "at");

-- CreateIndex
CREATE INDEX "OpsEvent_unitId_at_idx" ON "OpsEvent"("unitId", "at");

-- CreateIndex
CREATE INDEX "OpsEvent_propertyId_domain_at_idx" ON "OpsEvent"("propertyId", "domain", "at");

-- CreateIndex
CREATE INDEX "Guest_mergedIntoId_idx" ON "Guest"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsEvent" ADD CONSTRAINT "OpsEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsEvent" ADD CONSTRAINT "OpsEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (defense-in-depth, same tenant_isolation pattern as the other tenant-owned tables).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['StaffShift','OpsEvent']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
      WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
