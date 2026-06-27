-- CRS-compatible currency snapshot on reservations (additive, nullable). currency/totalMinor stay the
-- original booking values; these store the property-currency conversion + the FX rate/timestamp used.
ALTER TABLE "Reservation" ADD COLUMN "propertyCurrency" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "propertyTotalMinor" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "fxRate" DOUBLE PRECISION;
ALTER TABLE "Reservation" ADD COLUMN "fxAt" TIMESTAMP(3);
