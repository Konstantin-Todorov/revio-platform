-- The rate a stay was QUOTED, per night (PMS OBP §P4).
--
-- Rates move after a booking is made. Without this the folio re-resolves against the live table and
-- a guest confirmed at €120 gets billed €132 because somebody edited the occupancy rates in between
-- — the folio disagreeing with the confirmation email and with the OTA's record of the same booking.
--
-- The CRS quotes; the PMS bills what was quoted. This table is that boundary.
CREATE TABLE "ReservationNightRate" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "reservationLineId" TEXT NOT NULL,
  "date"              DATE NOT NULL,
  "occupancy"         INTEGER NOT NULL,
  "rateMinor"         INTEGER NOT NULL,
  "source"            TEXT NOT NULL DEFAULT 'booking',
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationNightRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationNightRate_reservationLineId_date_key"
  ON "ReservationNightRate"("reservationLineId", "date");
CREATE INDEX "ReservationNightRate_reservationLineId_idx"
  ON "ReservationNightRate"("reservationLineId");

ALTER TABLE "ReservationNightRate"
  ADD CONSTRAINT "ReservationNightRate_reservationLineId_fkey"
  FOREIGN KEY ("reservationLineId") REFERENCES "ReservationLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A hotel's own booking data. Tenant-scoped through the line's reservation rather than a duplicated
-- column, so the row cannot disagree with the stay it belongs to about who owns it.
ALTER TABLE "ReservationNightRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReservationNightRate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ReservationNightRate"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "ReservationLine" rl
      JOIN "Reservation" r ON r.id = rl."reservationId"
      WHERE rl.id = "ReservationNightRate"."reservationLineId"
        AND r."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "ReservationLine" rl
      JOIN "Reservation" r ON r.id = rl."reservationId"
      WHERE rl.id = "ReservationNightRate"."reservationLineId"
        AND r."tenantId" = current_setting('app.tenant_id', true)
    )
  );
