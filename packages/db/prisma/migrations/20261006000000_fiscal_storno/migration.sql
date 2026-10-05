-- Storno receipts for voided desk payments, and the printed receipt kept for mirroring. Additive only.
ALTER TABLE "FolioLine" ADD COLUMN "fiscalReceiptData" JSONB;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalStornoNo" TEXT;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalStornoAt" TIMESTAMP(3);
ALTER TABLE "FolioLine" ADD COLUMN "fiscalStornoReason" TEXT;
ALTER TABLE "FolioLine" ADD COLUMN "fiscalStornoSource" TEXT;
