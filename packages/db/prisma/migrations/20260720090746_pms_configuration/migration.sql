-- AlterTable
ALTER TABLE "PropertyDefaults" ADD COLUMN     "eInvoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fiscalizationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inspectionGate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jurisdiction" TEXT NOT NULL DEFAULT 'generic';
