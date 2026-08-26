-- The Channex CHANNEL uuid, distinct from externalPropertyId (which says which hotel).
-- Needed to activate, update or delete a channel created through the API.
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "externalChannelId" TEXT;
