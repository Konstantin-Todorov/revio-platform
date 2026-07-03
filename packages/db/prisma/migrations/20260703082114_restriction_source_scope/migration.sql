-- AlterTable
ALTER TABLE "RestrictionRule" ADD COLUMN     "sourceCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
