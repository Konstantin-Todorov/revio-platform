-- First-run setup: which products this property has finished onboarding for.
-- Written once per product so the welcome checklist never comes back after it is done.
ALTER TABLE "Property" ADD COLUMN "setupCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: a property that already has room types is already trading, and must not be greeted
-- with a "Welcome — 4 steps to get started" card on the next deploy. Only brand-new properties
-- (no room types yet) should see the checklist.
UPDATE "Property" p
SET "setupCompleted" = ARRAY['cm', 'crs', 'pms']
WHERE EXISTS (SELECT 1 FROM "RoomType" rt WHERE rt."propertyId" = p.id);
