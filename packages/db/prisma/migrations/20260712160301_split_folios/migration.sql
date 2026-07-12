-- DropIndex
DROP INDEX "Folio_reservationId_key";

-- AlterTable
ALTER TABLE "Folio" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'Guest';

-- CreateIndex
CREATE INDEX "Folio_reservationId_idx" ON "Folio"("reservationId");
