-- Fiscal printer through ErpNet.FP on the front-desk PC. Additive only.
ALTER TABLE "PropertyDefaults" ADD COLUMN "fiscalDevice" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "PropertyDefaults" ADD COLUMN "fiscalTaxGroups" JSONB;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalReceiptNo" TEXT;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalReceiptAt" TIMESTAMP(3);
ALTER TABLE "FolioLine" ADD COLUMN "fiscalDeviceSerial" TEXT;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalSource" TEXT;
