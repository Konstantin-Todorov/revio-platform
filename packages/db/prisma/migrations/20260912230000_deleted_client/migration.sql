-- A client can now be removed from the operator console, and this is what survives it.
--
-- Everything else about a deleted hotel is gone — 55 tables by cascade plus six the cascade cannot
-- reach — so without this row nobody could ever answer "what happened to them?". The audit trail of
-- a deletion cannot live inside the thing being deleted, which is why this table holds copies of the
-- facts rather than relations to them.
--
-- Operator-only, by the same policy every other operator table uses: a hotel must never be able to
-- read that another hotel was removed, or that any of this exists.
CREATE TABLE "DeletedClient" (
  "id"            TEXT NOT NULL,
  "tenantName"    TEXT NOT NULL,
  "tenantSlug"    TEXT NOT NULL,
  "wasDemo"       BOOLEAN NOT NULL DEFAULT false,
  "lastStatus"    TEXT NOT NULL,
  "clientSince"   TIMESTAMP(3) NOT NULL,
  "reservations"  INTEGER NOT NULL DEFAULT 0,
  "properties"    INTEGER NOT NULL DEFAULT 0,
  "users"         INTEGER NOT NULL DEFAULT 0,
  "deletedByName" TEXT NOT NULL,
  "deletedById"   TEXT NOT NULL,
  "deletedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeletedClient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletedClient_deletedAt_idx" ON "DeletedClient"("deletedAt");

ALTER TABLE "DeletedClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeletedClient" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "DeletedClient"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
