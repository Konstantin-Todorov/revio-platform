-- OBP H10 / L6 — whether a channel can express per-occupancy rates.
--
-- Default false, which is the honest default: a channel we have not confirmed gets the primary
-- occupancy's rate as a scalar and the limitations line says so, rather than being sent an options
-- array it silently drops and a hotel finding out from a booking at the wrong price.
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "supportsOccupancy" BOOLEAN NOT NULL DEFAULT false;

-- Channex-backed channels DO support it — that is the whole reason we integrate through Channex,
-- and it is verified in the ARI contract (§6.7a). Mock channels keep the default; they exist to
-- demonstrate the loop, not to model a real OTA's limits.
UPDATE "Channel" SET "supportsOccupancy" = true WHERE "connectivityMode" LIKE 'channex%';
