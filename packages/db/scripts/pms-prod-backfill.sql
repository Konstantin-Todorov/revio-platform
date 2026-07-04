-- One-time PMS prod backfill: enable hasPms + seed physical Units for the demo tenants' properties.
-- Idempotent: skips any property that already has Units. Mirrors packages/db/prisma/seed.ts seedUnits
-- (floor-numbered 101.., clean/dirty/inspected mix, no OOO). Runs as prod superuser (RLS bypassed).
BEGIN;

UPDATE "Tenant" SET "hasPms" = true WHERE slug IN ('hotel-sofia', 'black-sea-resort');

WITH rt AS (
  SELECT rt.id AS room_type_id, rt."propertyId", rt."tenantId", rt."unitKind",
         rt."totalRooms", rt."sortOrder"
  FROM "RoomType" rt
  JOIN "Tenant" t ON t.id = rt."tenantId"
  WHERE t.slug IN ('hotel-sofia', 'black-sea-resort')
),
expanded AS (
  SELECT rt.*, gs AS unit_idx,
         (row_number() OVER (PARTITION BY rt."propertyId" ORDER BY rt."sortOrder", gs) - 1) AS placed
  FROM rt, generate_series(1, rt."totalRooms") AS gs
)
INSERT INTO "Unit" (id, "tenantId", "propertyId", "roomTypeId", label, "unitKind", floor, "hkStatus", "sortOrder", "createdAt")
SELECT
  gen_random_uuid()::text,
  e."tenantId", e."propertyId", e.room_type_id,
  (floor(e.placed / 10) + 1)::int::text || lpad(((e.placed % 10) + 1)::int::text, 2, '0'),
  CASE WHEN e."unitKind" = 'bed' THEN 'bed' ELSE 'room' END,
  'Floor ' || (floor(e.placed / 10) + 1)::int::text,
  (ARRAY['clean','clean','inspected','clean','dirty','clean','clean','dirty','inspected','clean'])[(e.placed % 10) + 1],
  (e.unit_idx - 1)::int,
  now()
FROM expanded e
WHERE NOT EXISTS (SELECT 1 FROM "Unit" u WHERE u."propertyId" = e."propertyId");

COMMIT;
