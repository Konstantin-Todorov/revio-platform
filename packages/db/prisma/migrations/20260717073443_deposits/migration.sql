-- AlterTable
ALTER TABLE "FolioLine" ADD COLUMN     "depositTypeId" TEXT;

-- CreateTable
CREATE TABLE "DepositType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "behaviour" TEXT NOT NULL DEFAULT 'held',
    "vatTiming" TEXT NOT NULL DEFAULT 'use',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositType_propertyId_idx" ON "DepositType"("propertyId");

-- AddForeignKey
ALTER TABLE "DepositType" ADD CONSTRAINT "DepositType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
