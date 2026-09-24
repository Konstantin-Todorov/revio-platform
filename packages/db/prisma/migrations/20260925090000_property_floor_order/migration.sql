-- The order a hotel puts its floors in. Empty for every existing property, which keeps today's order
-- (by the number in each floor's name) until somebody moves one.
ALTER TABLE "Property" ADD COLUMN "floorOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
