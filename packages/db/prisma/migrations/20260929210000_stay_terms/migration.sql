-- A cancellation policy stops being a label: it carries the terms a guest is charged by.
ALTER TABLE "CancellationPolicy" ADD COLUMN "payment" TEXT NOT NULL DEFAULT 'guarantee';
ALTER TABLE "CancellationPolicy" ADD COLUMN "depositKind" TEXT;
ALTER TABLE "CancellationPolicy" ADD COLUMN "depositValue" INTEGER;
ALTER TABLE "CancellationPolicy" ADD COLUMN "balanceDaysBefore" INTEGER;
ALTER TABLE "CancellationPolicy" ADD COLUMN "refundable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CancellationPolicy" ADD COLUMN "freeCancelDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CancellationPolicy" ADD COLUMN "lateFee" TEXT NOT NULL DEFAULT 'first_night';
ALTER TABLE "CancellationPolicy" ADD COLUMN "lateFeePct" INTEGER;
ALTER TABLE "CancellationPolicy" ADD COLUMN "noShowFee" TEXT NOT NULL DEFAULT 'first_night';
ALTER TABLE "CancellationPolicy" ADD COLUMN "noShowFeePct" INTEGER;

-- The only policies that exist today are the demo seed's three; give them the terms their names
-- already promise. Matched on the seed's own codes, so a hotel's policy is never guessed at.
UPDATE "CancellationPolicy" SET "freeCancelDays" = 1 WHERE "code" = 'FC1';
UPDATE "CancellationPolicy" SET "freeCancelDays" = 3 WHERE "code" = 'FC3';
UPDATE "CancellationPolicy" SET "payment" = 'prepay', "refundable" = false, "noShowFee" = 'full' WHERE "code" = 'NR';
