-- One-time PMS Phase 4 prod backfill: seed the minibar/extras catalog for the demo tenants' properties.
-- Idempotent: skips any property that already has PosItems. Mirrors seed.ts seedPosItems.
BEGIN;

WITH props AS (
  SELECT p.id AS property_id, p."tenantId" AS tenant_id
  FROM "Property" p
  JOIN "Tenant" t ON t.id = p."tenantId"
  WHERE t.slug IN ('hotel-sofia', 'black-sea-resort')
    AND NOT EXISTS (SELECT 1 FROM "PosItem" pi WHERE pi."propertyId" = p.id)
),
items(name, category, price, ord) AS (
  VALUES
    ('Still Water', 'minibar', 200, 0),
    ('Sparkling Water', 'minibar', 250, 1),
    ('Coca-Cola', 'minibar', 300, 2),
    ('Orange Juice', 'minibar', 350, 3),
    ('Beer', 'minibar', 450, 4),
    ('White Wine (mini)', 'minibar', 800, 5),
    ('Peanuts', 'minibar', 350, 6),
    ('Chocolate Bar', 'minibar', 300, 7),
    ('Pringles', 'minibar', 400, 8),
    ('Breakfast (extra)', 'extra', 1200, 9),
    ('Late Check-out', 'extra', 2000, 10),
    ('Extra Bed', 'extra', 2500, 11),
    ('Laundry', 'extra', 1500, 12)
)
INSERT INTO "PosItem" (id, "tenantId", "propertyId", name, category, "priceMinor", active, "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, props.tenant_id, props.property_id, items.name, items.category, items.price, true, items.ord, now()
FROM props CROSS JOIN items;

COMMIT;
