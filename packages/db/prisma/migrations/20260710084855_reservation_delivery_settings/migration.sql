-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "notifyTodayArrivals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyTodayTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "notifyTodayTo" TEXT NOT NULL DEFAULT 'primary',
ADD COLUMN     "notifyTomorrowArrivals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyTomorrowTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "notifyTomorrowTo" TEXT NOT NULL DEFAULT 'primary',
ADD COLUMN     "reservationEmailPrimary" TEXT,
ADD COLUMN     "reservationEmailSecondary" TEXT;
