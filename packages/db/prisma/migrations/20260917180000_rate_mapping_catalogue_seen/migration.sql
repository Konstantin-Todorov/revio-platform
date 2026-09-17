-- What the channel says the mapped rate plan's room type is, recorded so a cross-wire is a
-- database question rather than an API call. Nullable: null means "never asked", which the
-- screens distinguish from "asked and correct".
ALTER TABLE "ChannelRatePlanMapping" ADD COLUMN "externalRoomIdSeen" TEXT;
ALTER TABLE "ChannelRatePlanMapping" ADD COLUMN "catalogueCheckedAt" TIMESTAMP(3);
