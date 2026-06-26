-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hasChannelManager" BOOLEAN NOT NULL DEFAULT true,
    "hasReservation" BOOLEAN NOT NULL DEFAULT false,
    "hasPms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Sofia',
    "baseCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "syncHorizonDays" INTEGER NOT NULL DEFAULT 365,
    "address" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unitKind" TEXT NOT NULL DEFAULT 'room',
    "totalInventory" INTEGER NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tags" TEXT[],
    "priceLogic" TEXT NOT NULL DEFAULT 'manual',
    "parentRatePlanId" TEXT,
    "derivedType" TEXT,
    "derivedDirection" TEXT,
    "derivedValue" INTEGER,
    "derivedRounding" TEXT,
    "derivedFloorMinor" INTEGER,
    "derivedCeilingMinor" INTEGER,
    "cancellationPolicyId" TEXT,
    "mealPlanId" TEXT,
    "defStopSell" BOOLEAN NOT NULL DEFAULT false,
    "defMinLos" INTEGER,
    "defMaxLos" INTEGER,
    "defCta" BOOLEAN NOT NULL DEFAULT false,
    "defCtd" BOOLEAN NOT NULL DEFAULT false,
    "defAdvancePurchaseMin" INTEGER,
    "defAdvancePurchaseMax" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancyAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "occupancy" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "rounding" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "OccupancyAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlanRoomType" (
    "ratePlanId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,

    CONSTRAINT "RatePlanRoomType_pkey" PRIMARY KEY ("ratePlanId","roomTypeId")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "externalPropertyId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "conversionType" TEXT NOT NULL DEFAULT 'none',
    "markupPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rounding" TEXT NOT NULL DEFAULT 'none',
    "supportedRestrictions" TEXT[],
    "lastSyncAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "externalRoomId" TEXT,
    "externalRateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'complete',

    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePrice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceMinor" INTEGER NOT NULL,

    CONSTRAINT "RatePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCell" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "availabilityOverride" INTEGER,
    "minLos" INTEGER,
    "maxLos" INTEGER,
    "cta" BOOLEAN NOT NULL DEFAULT false,
    "ctd" BOOLEAN NOT NULL DEFAULT false,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "advancePurchaseMin" INTEGER,
    "advancePurchaseMax" INTEGER,

    CONSTRAINT "DailyCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "ratePlanId" TEXT,
    "channelCodes" TEXT[],
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "daysOfWeek" TEXT NOT NULL DEFAULT 'all',
    "valueInt" INTEGER,
    "valueBool" BOOLEAN,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RestrictionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'imported',

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationLine" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,

    CONSTRAINT "ReservationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channelId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channelId" TEXT,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "productLabel" TEXT,
    "dateAffected" DATE,
    "recommendedAction" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT,
    "entity" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "source" TEXT NOT NULL,
    "channelCode" TEXT,
    "syncResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- CreateIndex
CREATE INDEX "RoomType_propertyId_idx" ON "RoomType"("propertyId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_propertyId_idx" ON "CancellationPolicy"("propertyId");

-- CreateIndex
CREATE INDEX "MealPlan_propertyId_idx" ON "MealPlan"("propertyId");

-- CreateIndex
CREATE INDEX "RatePlan_propertyId_idx" ON "RatePlan"("propertyId");

-- CreateIndex
CREATE INDEX "OccupancyAdjustment_ratePlanId_idx" ON "OccupancyAdjustment"("ratePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "OccupancyAdjustment_ratePlanId_occupancy_key" ON "OccupancyAdjustment"("ratePlanId", "occupancy");

-- CreateIndex
CREATE INDEX "RatePlanRoomType_roomTypeId_idx" ON "RatePlanRoomType"("roomTypeId");

-- CreateIndex
CREATE INDEX "Channel_propertyId_idx" ON "Channel"("propertyId");

-- CreateIndex
CREATE INDEX "ProductMapping_channelId_idx" ON "ProductMapping"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMapping_channelId_roomTypeId_ratePlanId_key" ON "ProductMapping"("channelId", "roomTypeId", "ratePlanId");

-- CreateIndex
CREATE INDEX "RatePrice_propertyId_date_idx" ON "RatePrice"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RatePrice_roomTypeId_ratePlanId_date_key" ON "RatePrice"("roomTypeId", "ratePlanId", "date");

-- CreateIndex
CREATE INDEX "DailyCell_propertyId_date_idx" ON "DailyCell"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCell_roomTypeId_date_key" ON "DailyCell"("roomTypeId", "date");

-- CreateIndex
CREATE INDEX "RestrictionRule_propertyId_idx" ON "RestrictionRule"("propertyId");

-- CreateIndex
CREATE INDEX "Reservation_propertyId_idx" ON "Reservation"("propertyId");

-- CreateIndex
CREATE INDEX "Reservation_channelId_idx" ON "Reservation"("channelId");

-- CreateIndex
CREATE INDEX "ReservationLine_reservationId_idx" ON "ReservationLine"("reservationId");

-- CreateIndex
CREATE INDEX "SyncEvent_propertyId_createdAt_idx" ON "SyncEvent"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorItem_propertyId_resolved_idx" ON "ErrorItem"("propertyId", "resolved");

-- CreateIndex
CREATE INDEX "AuditEntry_propertyId_createdAt_idx" ON "AuditEntry"("propertyId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_parentRatePlanId_fkey" FOREIGN KEY ("parentRatePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_cancellationPolicyId_fkey" FOREIGN KEY ("cancellationPolicyId") REFERENCES "CancellationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyAdjustment" ADD CONSTRAINT "OccupancyAdjustment_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlanRoomType" ADD CONSTRAINT "RatePlanRoomType_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlanRoomType" ADD CONSTRAINT "RatePlanRoomType_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCell" ADD CONSTRAINT "DailyCell_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCell" ADD CONSTRAINT "DailyCell_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestrictionRule" ADD CONSTRAINT "RestrictionRule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationLine" ADD CONSTRAINT "ReservationLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationLine" ADD CONSTRAINT "ReservationLine_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationLine" ADD CONSTRAINT "ReservationLine_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorItem" ADD CONSTRAINT "ErrorItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorItem" ADD CONSTRAINT "ErrorItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

