-- Promo codes for RevioDirect: a percentage off the rooms, per property.
ALTER TABLE "Reservation" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "promoDiscountMinor" INTEGER;

CREATE TABLE "PromoCode" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "percentOff"  INTEGER NOT NULL,
  "stayFrom"    DATE,
  "stayTo"      DATE,
  "minNights"   INTEGER,
  "ratePlanIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxUses"     INTEGER,
  "usedCount"   INTEGER NOT NULL DEFAULT 0,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_propertyId_code_key" ON "PromoCode"("propertyId", "code");
CREATE INDEX "PromoCode_tenantId_idx" ON "PromoCode"("tenantId");
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCode" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PromoCode"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PromoCode" TO revio_app;
  END IF;
END
$$;
