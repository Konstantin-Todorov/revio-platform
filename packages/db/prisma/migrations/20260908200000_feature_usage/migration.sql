-- Product analytics: how much each screen is used, aggregated on write.
--
-- Two small tables rather than an event log. A row per page view would grow with the customer's
-- business instead of ours, and would amount to a record of what somebody else's staff do all day.
-- Counting into a daily bucket answers every question we have and none we should not be asking.

CREATE TABLE "FeatureUsage" (
  "id"       TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "product"  TEXT NOT NULL,
  "route"    TEXT NOT NULL,
  "day"      TIMESTAMP(3) NOT NULL,
  "views"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FeatureUsage_pkey" PRIMARY KEY ("id")
);

-- The upsert target, and what keeps the table small.
CREATE UNIQUE INDEX "FeatureUsage_tenantId_product_route_day_key"
  ON "FeatureUsage"("tenantId", "product", "route", "day");
CREATE INDEX "FeatureUsage_tenantId_day_idx" ON "FeatureUsage"("tenantId", "day");
CREATE INDEX "FeatureUsage_day_product_idx" ON "FeatureUsage"("day", "product");

ALTER TABLE "FeatureUsage" ADD CONSTRAINT "FeatureUsage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActiveUserDay" (
  "id"       TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "product"  TEXT NOT NULL,
  "day"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActiveUserDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActiveUserDay_userId_product_day_key"
  ON "ActiveUserDay"("userId", "product", "day");
CREATE INDEX "ActiveUserDay_tenantId_day_idx" ON "ActiveUserDay"("tenantId", "day");

ALTER TABLE "ActiveUserDay" ADD CONSTRAINT "ActiveUserDay_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveUserDay" ADD CONSTRAINT "ActiveUserDay_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant-owned, so tenant-isolated like every other tenant table. A hotel may read its own usage;
-- the database refuses another hotel's even if application code asks for it.
ALTER TABLE "FeatureUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureUsage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FeatureUsage"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ActiveUserDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActiveUserDay" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ActiveUserDay"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));
