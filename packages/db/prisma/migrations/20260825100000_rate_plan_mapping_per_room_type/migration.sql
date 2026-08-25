-- A rate plan maps per ROOM TYPE, because that is how Channex models it.
--
-- Channex, and every OTA beneath it, ties a rate plan to exactly one room type. We model a rate plan
-- at property level: a hotel has one "Standard Rate" covering all six of its room types. The two only
-- line up if the mapping carries the room type too — and it did not.
--
-- The consequence was silent and expensive. A hotel with three room types and one Standard Rate
-- mapped that plan to a single Channex rate plan; every push then sent all three room types at that
-- one plan, last write wins. Two of the three room types carried the wrong price on every channel and
-- had no rate plan on the OTA at all — with the Sync Center reporting success, because from our side
-- the push succeeded.
--
-- It never showed up in certification because the cert property's data was hand-shaped 2 room types ×
-- 4 rate plans to mirror Channex exactly. Real hotels are not shaped that way: of the properties in
-- production right now, one has 3 room types and a single rate plan.
--
-- Nullable, deliberately. NULL means "applies to any room type" — which is what every existing row
-- means and what the mock channels have always meant. The resolver prefers an exact room-type match
-- and falls back to NULL, so nothing that works today changes behaviour.

ALTER TABLE "ChannelRatePlanMapping" ADD COLUMN "roomTypeId" TEXT;

ALTER TABLE "ChannelRatePlanMapping"
  ADD CONSTRAINT "ChannelRatePlanMapping_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Postgres treats NULLs as distinct in a UNIQUE index, so the old (channelId, ratePlanId) pair can no
-- longer be the constraint: it would block a second room-specific row for the same plan, which is the
-- entire point of this change.
DROP INDEX IF EXISTS "ChannelRatePlanMapping_channelId_ratePlanId_key";
CREATE UNIQUE INDEX "ChannelRatePlanMapping_channelId_ratePlanId_roomTypeId_key"
  ON "ChannelRatePlanMapping"("channelId", "ratePlanId", "roomTypeId");

CREATE INDEX IF NOT EXISTS "ChannelRatePlanMapping_roomTypeId_idx" ON "ChannelRatePlanMapping"("roomTypeId");
