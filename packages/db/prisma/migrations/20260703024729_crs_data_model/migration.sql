-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "bookingSourceId" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "bookingSourceId" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "guestId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentGuarantee" TEXT,
ALTER COLUMN "channelId" DROP NOT NULL,
ALTER COLUMN "externalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReservationLine" ADD COLUMN     "guestsCount" INTEGER,
ADD COLUMN     "priceMinor" INTEGER;

-- CreateTable
CREATE TABLE "RoomInventoryPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "rooms" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomInventoryPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "reservationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "specialRequests" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BookingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxFee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pct" DOUBLE PRECISION,
    "amountMinor" INTEGER,
    "basis" TEXT NOT NULL,
    "inclusion" TEXT NOT NULL DEFAULT 'excluded',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TaxFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "targetDate" DATE NOT NULL,
    "roomsSold" INTEGER NOT NULL,
    "revenueMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PickupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDefaults" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "defStopSell" BOOLEAN NOT NULL DEFAULT false,
    "defMinLos" INTEGER,
    "defMaxLos" INTEGER,
    "defCta" BOOLEAN NOT NULL DEFAULT false,
    "defCtd" BOOLEAN NOT NULL DEFAULT false,
    "defAdvancePurchaseMin" INTEGER,
    "defAdvancePurchaseMax" INTEGER,
    "countNoShowsAsSold" BOOLEAN NOT NULL DEFAULT true,
    "revenueDisplay" TEXT NOT NULL DEFAULT 'gross',
    "pickupOffsetDays" INTEGER NOT NULL DEFAULT 7,
    "holdTtlMinutes" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "PropertyDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "RoleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomInventoryPeriod_roomTypeId_dateFrom_idx" ON "RoomInventoryPeriod"("roomTypeId", "dateFrom");

-- CreateIndex
CREATE INDEX "RoomInventoryPeriod_propertyId_idx" ON "RoomInventoryPeriod"("propertyId");

-- CreateIndex
CREATE INDEX "Hold_propertyId_status_idx" ON "Hold"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Hold_roomTypeId_checkIn_idx" ON "Hold"("roomTypeId", "checkIn");

-- CreateIndex
CREATE INDEX "Guest_propertyId_lastName_idx" ON "Guest"("propertyId", "lastName");

-- CreateIndex
CREATE INDEX "BookingSource_propertyId_idx" ON "BookingSource"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSource_propertyId_name_key" ON "BookingSource"("propertyId", "name");

-- CreateIndex
CREATE INDEX "TaxFee_propertyId_idx" ON "TaxFee"("propertyId");

-- CreateIndex
CREATE INDEX "PickupSnapshot_propertyId_targetDate_idx" ON "PickupSnapshot"("propertyId", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "PickupSnapshot_propertyId_roomTypeId_snapshotDate_targetDat_key" ON "PickupSnapshot"("propertyId", "roomTypeId", "snapshotDate", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyDefaults_propertyId_key" ON "PropertyDefaults"("propertyId");

-- CreateIndex
CREATE INDEX "PermissionRole_tenantId_idx" ON "PermissionRole"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionRole_tenantId_name_key" ON "PermissionRole"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAccess_roleId_group_key" ON "RoleAccess"("roleId", "group");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_bookingSourceId_fkey" FOREIGN KEY ("bookingSourceId") REFERENCES "BookingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookingSourceId_fkey" FOREIGN KEY ("bookingSourceId") REFERENCES "BookingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInventoryPeriod" ADD CONSTRAINT "RoomInventoryPeriod_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInventoryPeriod" ADD CONSTRAINT "RoomInventoryPeriod_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSource" ADD CONSTRAINT "BookingSource_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxFee" ADD CONSTRAINT "TaxFee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupSnapshot" ADD CONSTRAINT "PickupSnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupSnapshot" ADD CONSTRAINT "PickupSnapshot_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDefaults" ADD CONSTRAINT "PropertyDefaults_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAccess" ADD CONSTRAINT "RoleAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PermissionRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (defense-in-depth, same tenant_isolation pattern as enable_rls).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['RoomInventoryPeriod','Hold','Guest','BookingSource','TaxFee','PickupSnapshot','PropertyDefaults','PermissionRole','RoleAccess']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
      WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
