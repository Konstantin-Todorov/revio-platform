-- The hotel's public review scores, shown on RevioDirect. Entered by the hotel; never from guests.
CREATE TABLE "PublicRating" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "scoreTenths" INTEGER NOT NULL,
  "reviewCount" INTEGER,
  "url"         TEXT,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicRating_propertyId_source_key" ON "PublicRating"("propertyId", "source");
CREATE INDEX "PublicRating_tenantId_idx" ON "PublicRating"("tenantId");
ALTER TABLE "PublicRating" ADD CONSTRAINT "PublicRating_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicRating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicRating" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PublicRating"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PublicRating" TO revio_app;
  END IF;
END
$$;
