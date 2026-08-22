-- PMS state-machine fix (refinement round 2, §1).
--
-- Two additive, nullable columns. Nothing is backfilled here on purpose: a reservation that never
-- departed and a reservation that departed before this column existed are genuinely different, and
-- guessing between them would write fiction into the record. The stuck records are repaired by an
-- explicit, reviewed script instead.

-- The stay ended. Operational (PMS), deliberately NOT a Reservation.status value — status is the
-- CRS's commercial record and is read by the availability waterfall, the CM's ARI pushes and every
-- revenue metric.
ALTER TABLE "Reservation" ADD COLUMN "departedAt" TIMESTAMP(3);

-- How a closed folio ended, so "closed" is never ambiguous about money.
-- settled | outstanding | paid_offsystem | written_off
ALTER TABLE "Folio" ADD COLUMN "outcome" TEXT;
ALTER TABLE "Folio" ADD COLUMN "outcomeNote" TEXT;
ALTER TABLE "Folio" ADD COLUMN "outcomeAt" TIMESTAMP(3);
ALTER TABLE "Folio" ADD COLUMN "outcomeById" TEXT;

-- The receivables view reads exactly this: closed folios that still owe money.
CREATE INDEX "Folio_propertyId_outcome_idx" ON "Folio"("propertyId", "outcome");

-- Front Desk asks "is this stay still in the house?" on every load.
CREATE INDEX "Reservation_propertyId_departedAt_idx" ON "Reservation"("propertyId", "departedAt");
