-- Row-Level Security: DB-enforced tenant isolation (defense-in-depth on top of app-level scoping).
--
-- Each tenant-owned table gets ENABLE + FORCE ROW LEVEL SECURITY and a single `tenant_isolation`
-- policy keyed on two transaction-local GUCs set by the app's scoped Prisma clients (see src/rls.ts):
--   app.tenant_id  -> the current tenant; rows match when "tenantId" equals it
--   app.bypass='on'-> operator/system perimeter; the policy passes for every row
-- FORCE makes the policy apply even to the table owner (the Railway/app DB role is the owner), so a
-- buggy query without a tenant context sees NOTHING rather than another tenant's rows (fail-closed).
--
-- OperatorUser is intentionally NOT covered: it is operator-global staff, not tenant data.

-- Reusable predicate (inlined per table): tenant match OR system bypass.
--   ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')

-- Tenant: keyed on the row's own id (the Tenant IS the tenant).
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING ("id" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("id" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

-- tenantId-bearing tables.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Property";
CREATE POLICY tenant_isolation ON "Property"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "RoomType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoomType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RoomType";
CREATE POLICY tenant_isolation ON "RoomType"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "CancellationPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CancellationPolicy" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CancellationPolicy";
CREATE POLICY tenant_isolation ON "CancellationPolicy"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "MealPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MealPlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "MealPlan";
CREATE POLICY tenant_isolation ON "MealPlan"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "RatePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RatePlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RatePlan";
CREATE POLICY tenant_isolation ON "RatePlan"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "OccupancyAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupancyAdjustment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OccupancyAdjustment";
CREATE POLICY tenant_isolation ON "OccupancyAdjustment"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "Channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Channel" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Channel";
CREATE POLICY tenant_isolation ON "Channel"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "ProductMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductMapping" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ProductMapping";
CREATE POLICY tenant_isolation ON "ProductMapping"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "RatePrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RatePrice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RatePrice";
CREATE POLICY tenant_isolation ON "RatePrice"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "DailyCell" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyCell" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DailyCell";
CREATE POLICY tenant_isolation ON "DailyCell"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "RestrictionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RestrictionRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RestrictionRule";
CREATE POLICY tenant_isolation ON "RestrictionRule"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "Reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reservation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Reservation";
CREATE POLICY tenant_isolation ON "Reservation"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "SyncEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SyncEvent";
CREATE POLICY tenant_isolation ON "SyncEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "ErrorItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ErrorItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ErrorItem";
CREATE POLICY tenant_isolation ON "ErrorItem"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

ALTER TABLE "AuditEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditEntry";
CREATE POLICY tenant_isolation ON "AuditEntry"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');

-- Child/join tables without a tenantId column: isolate via the parent, which is itself RLS-protected.
-- The inner SELECT is subject to the parent's policy, so the row is reachable only when the parent is
-- visible under the current tenant context (or bypass).
ALTER TABLE "RatePlanRoomType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RatePlanRoomType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RatePlanRoomType";
CREATE POLICY tenant_isolation ON "RatePlanRoomType"
  USING (EXISTS (SELECT 1 FROM "RatePlan" rp WHERE rp."id" = "RatePlanRoomType"."ratePlanId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "RatePlan" rp WHERE rp."id" = "RatePlanRoomType"."ratePlanId"));

ALTER TABLE "ReservationLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReservationLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ReservationLine";
CREATE POLICY tenant_isolation ON "ReservationLine"
  USING (EXISTS (SELECT 1 FROM "Reservation" r WHERE r."id" = "ReservationLine"."reservationId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Reservation" r WHERE r."id" = "ReservationLine"."reservationId"));
