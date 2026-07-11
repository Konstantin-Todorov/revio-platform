-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "cmKind" TEXT NOT NULL DEFAULT 'reviolink_internal',
ADD COLUMN     "cmStatus" TEXT NOT NULL DEFAULT 'connected';
