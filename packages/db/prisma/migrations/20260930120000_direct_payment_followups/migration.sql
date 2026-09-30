-- After a RevioDirect booking: the Customer that makes the card reusable, the balance charge, fees and refunds.
ALTER TABLE "Reservation" ADD COLUMN "paymentCustomerId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "balanceChargedAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN "balancePaymentRef" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "balanceChargeError" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "feeChargedMinor" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "refundedOnlineMinor" INTEGER;
