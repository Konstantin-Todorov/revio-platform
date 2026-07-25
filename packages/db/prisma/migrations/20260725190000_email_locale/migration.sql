-- DropIndex
DROP INDEX "EmailTemplate_propertyId_key_key";

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_propertyId_key_locale_key" ON "EmailTemplate"("propertyId", "key", "locale");

