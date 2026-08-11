-- A date-scoped restriction can now name ONE rate plan.
--
-- DailyCell was keyed on (roomTypeId, date), so "minimum stay 2 on the flexible rate and 10 on bed
-- & breakfast, over dates that overlap" could not be stored: the second edit overwrote the first.
-- Channex certification test 7 asks for exactly that, and a hotel wanting a longer minimum stay on
-- its cheapest rate is an ordinary request.
--
-- NULL keeps the old meaning — "every rate plan of this room" — so every existing row stays correct
-- and unmigrated, and a calendar edit still writes one row per room per date.

ALTER TABLE "DailyCell" ADD COLUMN "ratePlanId" TEXT;

ALTER TABLE "DailyCell"
  ADD CONSTRAINT "DailyCell_ratePlanId_fkey"
  FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "DailyCell_roomTypeId_date_key";

CREATE UNIQUE INDEX "DailyCell_roomTypeId_ratePlanId_date_key"
  ON "DailyCell" ("roomTypeId", "ratePlanId", "date");

-- Postgres treats NULLs as distinct in a unique index, so the constraint above would happily accept
-- a hundred room-wide cells for the same date. This is the half Prisma cannot express.
CREATE UNIQUE INDEX "DailyCell_roomTypeId_date_all_plans_key"
  ON "DailyCell" ("roomTypeId", "date") WHERE "ratePlanId" IS NULL;

CREATE INDEX "DailyCell_ratePlanId_idx" ON "DailyCell" ("ratePlanId");
