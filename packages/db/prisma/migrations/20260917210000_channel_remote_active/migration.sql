-- Whether the channel is switched on at Channex — what we are billed for, as opposed to `status`,
-- which only says what we are doing. Null = never created or never checked.
ALTER TABLE "Channel" ADD COLUMN "externalChannelActive" BOOLEAN;

-- Backfill: every channel we created through the API was activated and nothing has ever switched one
-- off, so an existing externalChannelId means it is still active on their side and still billable.
UPDATE "Channel" SET "externalChannelActive" = true WHERE "externalChannelId" IS NOT NULL;
