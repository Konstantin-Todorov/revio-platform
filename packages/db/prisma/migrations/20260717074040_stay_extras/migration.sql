-- CreateTable
CREATE TABLE "StayExtra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StayExtra_reservationId_idx" ON "StayExtra"("reservationId");

-- CreateIndex
CREATE INDEX "StayExtra_propertyId_idx" ON "StayExtra"("propertyId");

-- AddForeignKey
ALTER TABLE "StayExtra" ADD CONSTRAINT "StayExtra_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
