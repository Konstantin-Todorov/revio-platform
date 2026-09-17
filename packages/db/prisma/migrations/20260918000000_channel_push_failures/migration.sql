-- Pushes the channel itself recorded as failed, from its own task log. The destination's verdict,
-- as opposed to our SyncEvent, which is ours. Written by the nightly mapping audit.
ALTER TABLE "Channel" ADD COLUMN "pushFailures" INTEGER NOT NULL DEFAULT 0;
