-- The day-before reminder of an automatic balance charge, sent once.
ALTER TABLE "Reservation" ADD COLUMN "balanceReminderSentAt" TIMESTAMP(3);
