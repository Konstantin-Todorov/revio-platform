-- RevioDirect: the hotel's own "cheaper than on booking sites" discount, and what it took off a booking.
ALTER TABLE "Property" ADD COLUMN "directDiscountPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "directDiscountMinor" INTEGER;
