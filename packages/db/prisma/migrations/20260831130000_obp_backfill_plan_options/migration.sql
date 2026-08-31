-- OBP H13 — every existing rate plan gets its one occupancy option.
--
-- Before OBP a plan had no occupancy rows at all, because the concept did not exist. Under the new
-- model a plan with no options cannot state its own default price: `resolveRate` finds the stored
-- RatePrice for a date and works, but a date with no stored price has nothing to fall back to.
--
-- Per-room is the ONE-ROW special case at max occupancy, so the backfill is exactly that: one row,
-- primary, manual, no price of its own (the stored per-date prices remain the source).
--
-- The occupancy is the SMALLEST cap among the room types the plan is sold on — `planCeiling`'s rule,
-- because one option set has to be valid everywhere the plan sells. A plan linked to no room type
-- applies to all of them (the platform's "unscoped means everything" convention), so it takes the
-- smallest active room in the property.
--
-- Idempotent: only plans with no options are touched.

INSERT INTO "RatePlanOccupancy" ("id", "tenantId", "ratePlanId", "occupancy", "isPrimary", "mode", "rounding")
SELECT
  gen_random_uuid()::text,
  rp."tenantId",
  rp.id,
  GREATEST(1, COALESCE(
    -- The plan's own room types, when it names any…
    (SELECT MIN(rt."maxGuests")
       FROM "RatePlanRoomType" link
       JOIN "RoomType" rt ON rt.id = link."roomTypeId"
      WHERE link."ratePlanId" = rp.id AND rt.active),
    -- …otherwise every active room in the property, since unscoped means everything.
    (SELECT MIN(rt2."maxGuests")
       FROM "RoomType" rt2
      WHERE rt2."propertyId" = rp."propertyId" AND rt2.active),
    1
  )),
  true,
  'manual',
  'none'
FROM "RatePlan" rp
WHERE NOT EXISTS (
  SELECT 1 FROM "RatePlanOccupancy" o WHERE o."ratePlanId" = rp.id
);

-- Exactly one primary per plan is a Channex requirement and ours. A plan that already had options
-- but no primary — possible only for rows carried over from the old delta model — gets its largest
-- occupancy promoted, which is the per-room reading of what it meant.
UPDATE "RatePlanOccupancy" o
SET "isPrimary" = true
WHERE o.id = (
  SELECT o2.id FROM "RatePlanOccupancy" o2
   WHERE o2."ratePlanId" = o."ratePlanId"
   ORDER BY o2."occupancy" DESC
   LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "RatePlanOccupancy" p WHERE p."ratePlanId" = o."ratePlanId" AND p."isPrimary"
);
