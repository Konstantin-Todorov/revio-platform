-- Two-stream mapping: a channel maps each Room Type and each Rate Plan independently to its own ids
-- (mirrors Channex: availability keyed on room type, rates/restrictions on rate plan). Replaces the
-- per-product externalRoomId/externalRateId redundancy in ProductMapping (kept for now, unused).

CREATE TABLE "ChannelRoomTypeMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "externalRoomId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    CONSTRAINT "ChannelRoomTypeMapping_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChannelRatePlanMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "externalRateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    CONSTRAINT "ChannelRatePlanMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelRoomTypeMapping_channelId_roomTypeId_key" ON "ChannelRoomTypeMapping"("channelId", "roomTypeId");
CREATE INDEX "ChannelRoomTypeMapping_channelId_idx" ON "ChannelRoomTypeMapping"("channelId");
CREATE UNIQUE INDEX "ChannelRatePlanMapping_channelId_ratePlanId_key" ON "ChannelRatePlanMapping"("channelId", "ratePlanId");
CREATE INDEX "ChannelRatePlanMapping_channelId_idx" ON "ChannelRatePlanMapping"("channelId");

ALTER TABLE "ChannelRoomTypeMapping" ADD CONSTRAINT "ChannelRoomTypeMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRoomTypeMapping" ADD CONSTRAINT "ChannelRoomTypeMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRatePlanMapping" ADD CONSTRAINT "ChannelRatePlanMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRatePlanMapping" ADD CONSTRAINT "ChannelRatePlanMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing ProductMapping (one row per channel/room and channel/rate; prefer a mapped id).
INSERT INTO "ChannelRoomTypeMapping" ("id", "tenantId", "channelId", "roomTypeId", "externalRoomId", "status")
SELECT DISTINCT ON ("channelId", "roomTypeId")
  gen_random_uuid()::text, "tenantId", "channelId", "roomTypeId", "externalRoomId",
  CASE WHEN "externalRoomId" IS NOT NULL THEN 'complete' ELSE 'incomplete' END
FROM "ProductMapping"
ORDER BY "channelId", "roomTypeId", ("externalRoomId" IS NULL);

INSERT INTO "ChannelRatePlanMapping" ("id", "tenantId", "channelId", "ratePlanId", "externalRateId", "status")
SELECT DISTINCT ON ("channelId", "ratePlanId")
  gen_random_uuid()::text, "tenantId", "channelId", "ratePlanId", "externalRateId",
  CASE WHEN "externalRateId" IS NOT NULL THEN 'complete' ELSE 'incomplete' END
FROM "ProductMapping"
ORDER BY "channelId", "ratePlanId", ("externalRateId" IS NULL);

-- RLS (defense-in-depth, same pattern as enable_rls).
ALTER TABLE "ChannelRoomTypeMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelRoomTypeMapping" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChannelRoomTypeMapping"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');
ALTER TABLE "ChannelRatePlanMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChannelRatePlanMapping" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ChannelRatePlanMapping"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on');
