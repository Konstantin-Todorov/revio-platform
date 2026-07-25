-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "emailBrandColor" TEXT,
ADD COLUMN     "emailFooterText" TEXT,
ADD COLUMN     "emailLogoUrl" TEXT,
ADD COLUMN     "emailReplyTo" TEXT,
ADD COLUMN     "emailSenderName" TEXT;

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_propertyId_idx" ON "EmailTemplate"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_propertyId_key_key" ON "EmailTemplate"("propertyId", "key");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS (same tenant_isolation pattern as every other tenant-owned table).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['EmailTemplate']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
      WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
