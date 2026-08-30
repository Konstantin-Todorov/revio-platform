-- OBP H1 — the occupancy dimension.
--
-- Rate goes from (room type, rate plan, date) to (room type, rate plan, date, occupancy).
-- Per-room becomes the ONE-ROW special case at max occupancy, so both pricing models share one
-- schema and switching between them expands or collapses rows rather than moving data.
--
-- Written to be safe on a live database: every existing row keeps working, and the property default
-- is per_room, so nothing changes behaviour until a hotel opts in.

-- 1. Property-level OBP configuration (CRS §6.2).
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "pricingModel"      TEXT    NOT NULL DEFAULT 'per_room';
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "occupancySeedMode" TEXT    NOT NULL DEFAULT 'copy';
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "occupancyDisplay"  TEXT    NOT NULL DEFAULT 'primary_expand';
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "ageInfantMax"      INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "ageChildMax"       INTEGER NOT NULL DEFAULT 11;
ALTER TABLE "PropertyDefaults" ADD COLUMN IF NOT EXISTS "cmObpCapability"   BOOLEAN NOT NULL DEFAULT false;

-- 2. Which occupancy is primary for a room type. Null = the ceiling (the pre-OBP behaviour).
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "defaultOccupancy" INTEGER;

-- 3. Rate-plan OBP fields. All nullable/defaulted: a plan with none of them set behaves exactly as
--    it does today.
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "pricingModel"     TEXT;
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "primaryOccupancy" INTEGER;
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "rateMode"         TEXT;
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "childrenFeeMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RatePlan" ADD COLUMN IF NOT EXISTS "infantFeeMinor"   INTEGER NOT NULL DEFAULT 0;

-- 4. OccupancyAdjustment becomes RatePlanOccupancy — a first-class occupancy ROW rather than a delta.
--    Renamed in place so the rows and the RLS policy survive; the old delta columns keep their
--    meaning as the derivation rule (Channex `derived_option`).
ALTER TABLE "OccupancyAdjustment" RENAME TO "RatePlanOccupancy";
ALTER TABLE "RatePlanOccupancy" RENAME CONSTRAINT "OccupancyAdjustment_pkey" TO "RatePlanOccupancy_pkey";
ALTER INDEX  "OccupancyAdjustment_ratePlanId_occupancy_key" RENAME TO "RatePlanOccupancy_ratePlanId_occupancy_key";
ALTER INDEX  "OccupancyAdjustment_ratePlanId_idx"           RENAME TO "RatePlanOccupancy_ratePlanId_idx";
ALTER TABLE "RatePlanOccupancy" RENAME CONSTRAINT "OccupancyAdjustment_ratePlanId_fkey" TO "RatePlanOccupancy_ratePlanId_fkey";

ALTER TABLE "RatePlanOccupancy" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RatePlanOccupancy" ADD COLUMN IF NOT EXISTS "mode"      TEXT    NOT NULL DEFAULT 'manual';
ALTER TABLE "RatePlanOccupancy" ADD COLUMN IF NOT EXISTS "rateMinor" INTEGER;

-- The delta columns become the derivation rule and are therefore optional: a `manual` row states
-- its price and needs no rule at all.
ALTER TABLE "RatePlanOccupancy" ALTER COLUMN "adjustmentType" DROP NOT NULL;
ALTER TABLE "RatePlanOccupancy" ALTER COLUMN "direction"      DROP NOT NULL;
ALTER TABLE "RatePlanOccupancy" ALTER COLUMN "value"          DROP NOT NULL;

-- Existing rows were deltas by definition.
UPDATE "RatePlanOccupancy" SET "mode" = 'derived' WHERE "adjustmentType" IS NOT NULL;

-- 5. The occupancy dimension on stored prices.
--
--    Backfilled to the room type's max, because that is exactly what an existing price meant: the
--    price for a full room. The column stays nullable in the schema only so this backfill can run;
--    every write sets it.
ALTER TABLE "RatePrice" ADD COLUMN IF NOT EXISTS "occupancy" INTEGER;

UPDATE "RatePrice" rp
SET "occupancy" = rt."maxGuests"
FROM "RoomType" rt
WHERE rt.id = rp."roomTypeId" AND rp."occupancy" IS NULL;

-- The unique key gains occupancy. Without it a per-person plan could hold only one price per date
-- and the second occupancy would silently overwrite the first.
DROP INDEX IF EXISTS "RatePrice_roomTypeId_ratePlanId_date_key";
CREATE UNIQUE INDEX "RatePrice_roomTypeId_ratePlanId_date_occupancy_key"
  ON "RatePrice"("roomTypeId", "ratePlanId", "date", "occupancy");
