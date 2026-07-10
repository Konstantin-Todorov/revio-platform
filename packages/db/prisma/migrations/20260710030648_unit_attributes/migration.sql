-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "connectingUnitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
