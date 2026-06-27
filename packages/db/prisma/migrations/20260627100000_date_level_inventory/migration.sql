-- V2 model: inventory is managed at the date level.
-- RoomType.totalInventory (sell baseline) becomes totalRooms (a physical cap / safety-net only).
-- DailyCell.availabilityOverride becomes inventory (the per-date "rooms to sell" allotment).
-- Bookable = inventory − rooms sold, where rooms sold is derived from confirmed reservations.
ALTER TABLE "RoomType" RENAME COLUMN "totalInventory" TO "totalRooms";
ALTER TABLE "DailyCell" RENAME COLUMN "availabilityOverride" TO "inventory";
