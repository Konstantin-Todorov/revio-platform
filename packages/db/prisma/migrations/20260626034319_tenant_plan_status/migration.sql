-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
