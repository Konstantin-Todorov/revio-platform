-- Guest-facing room content. Purely additive and all nullable/defaulted: every existing room type
-- keeps working untouched, and a hotel fills these in when it has something to say.
ALTER TABLE "RoomType"
  ADD COLUMN "sizeSqm"   INTEGER,
  ADD COLUMN "bedSetup"  TEXT,
  ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
