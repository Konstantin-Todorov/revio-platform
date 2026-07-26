-- Drop the original single-row-per-product mapping table.
--
-- It was superseded by the two-stream model (ChannelRoomTypeMapping + ChannelRatePlanMapping),
-- which mirrors how Channex actually keys things: availability on the room type, rates and
-- restrictions on the rate plan. Nothing has read or written ProductMapping since that change; it
-- survived only in the schema, where it misled anyone reading the mapping model for the first time.
--
-- Verified empty before dropping. Guarded anyway: if a deployment somehow holds rows, this fails
-- loudly rather than silently discarding mapping data.
DO $$
DECLARE row_count BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ProductMapping') THEN
    EXECUTE 'SELECT count(*) FROM "ProductMapping"' INTO row_count;
    IF row_count > 0 THEN
      RAISE EXCEPTION 'ProductMapping still holds % row(s) — investigate before dropping', row_count;
    END IF;
  END IF;
END $$;

ALTER TABLE "ProductMapping" DROP CONSTRAINT IF EXISTS "ProductMapping_channelId_fkey";
ALTER TABLE "ProductMapping" DROP CONSTRAINT IF EXISTS "ProductMapping_roomTypeId_fkey";
ALTER TABLE "ProductMapping" DROP CONSTRAINT IF EXISTS "ProductMapping_ratePlanId_fkey";
DROP TABLE IF EXISTS "ProductMapping";
