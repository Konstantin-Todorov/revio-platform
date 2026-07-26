-- Uploaded brand assets (guest-email logo today; invoice logo/favicon later).
-- Kept out of Property so the property row stays cheap to read: every screen loads it, almost
-- none of them need the image bytes.
ALTER TABLE "Property" ADD COLUMN "emailLogoVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'email_logo',
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrandAsset_propertyId_idx" ON "BrandAsset"("propertyId");
CREATE UNIQUE INDEX "BrandAsset_propertyId_kind_key" ON "BrandAsset"("propertyId", "kind");

ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation, same policy shape as every other tenant-owned table.
ALTER TABLE "BrandAsset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BrandAsset"
  USING (current_setting('app.bypass', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
