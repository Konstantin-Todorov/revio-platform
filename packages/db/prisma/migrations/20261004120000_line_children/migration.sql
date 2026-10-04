-- Children and infants on a reservation line — a separate axis from adult occupancy (OBP §6.9).
ALTER TABLE "ReservationLine" ADD COLUMN "childrenCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReservationLine" ADD COLUMN "infantsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReservationLine" ADD COLUMN "childAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
