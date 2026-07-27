-- Room photographs for the booking engine.
--
-- Object KEYS only; the bytes live in object storage (@revio/storage). Putting a hundred properties'
-- worth of photos in Postgres would add gigabytes to every backup and restore for content that a
-- CDN serves better and an object store holds for a tenth the price.
CREATE TABLE "RoomTypePhoto" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "fullKey"    TEXT NOT NULL,
  "thumbKey"   TEXT NOT NULL,
  "width"      INTEGER NOT NULL,
  "height"     INTEGER NOT NULL,
  "byteSize"   INTEGER NOT NULL,
  "alt"        TEXT NOT NULL DEFAULT '',
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomTypePhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomTypePhoto_roomTypeId_sortOrder_idx" ON "RoomTypePhoto"("roomTypeId", "sortOrder");
CREATE INDEX "RoomTypePhoto_propertyId_idx" ON "RoomTypePhoto"("propertyId");

-- Deleting a room type takes its photos with it. The stored OBJECTS are swept separately: a
-- cascade cannot reach into a bucket, so orphaned bytes are a known, bounded cost rather than a
-- reason to keep dead rows around.
ALTER TABLE "RoomTypePhoto"
  ADD CONSTRAINT "RoomTypePhoto_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (defense-in-depth, same tenant_isolation pattern as every other tenant-owned table).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['RoomTypePhoto']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
      WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
