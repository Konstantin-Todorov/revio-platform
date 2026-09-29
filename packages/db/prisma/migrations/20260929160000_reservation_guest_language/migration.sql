-- The language a guest booked in, so every later mail to them follows it.
ALTER TABLE "Reservation" ADD COLUMN "guestLanguage" TEXT;
