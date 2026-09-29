-- RevioDirect takes money: what was paid online, on whose account, and the terms agreed to.
ALTER TABLE "Reservation" ADD COLUMN "onlinePaidMinor" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "onlinePaymentRef" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentAccountId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "stayTerms" JSONB;
ALTER TABLE "Reservation" ADD COLUMN "balanceChargeMinor" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "balanceChargeOn" DATE;
