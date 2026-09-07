-- A hotel asking for help.
--
-- docs/ACTION-REQUIRED.md has carried "support and incident basics — undefined" since before any
-- hotel was live, with the question stated plainly: who does a hotel call at 23:00 when check-in
-- fails? While nobody is live that is theoretical; the week somebody is, it is the most important
-- thing in the product, and a support route improvised during an incident loses the incident.
--
-- ⚠️ The CONTEXT columns are the point. `product`, `route`, `propertyId` and `userId` are captured
-- automatically, never typed. A generic contact form yields "it doesn't work"; this arrives as
-- "Hotel Sofia · RevioPMS · /housekeeping · Maria, manager" and triage starts from something
-- reproducible. The person filling this in is having a bad morning.

CREATE TABLE "SupportRequest" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  -- Which hotel of a group, when the session had one in view.
  "propertyId"   TEXT,
  -- Nullable so deactivating a leaver never deletes their reports.
  "userId"       TEXT,

  -- cm | crs | pms
  "product"      TEXT NOT NULL,
  "route"        TEXT,
  -- urgent | problem | question. The promise attached to each lives in @revio/core, beside the
  -- hours the operator's queue counts — one commitment, two renderings, so they cannot drift.
  "kind"         TEXT NOT NULL DEFAULT 'problem',
  "message"      TEXT NOT NULL,

  -- Copied at the time of asking, so a reply still works after the account changes or is closed.
  "contactName"  TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,

  -- Null is the working queue, the same convention Lead uses.
  "handledAt"    TIMESTAMP(3),
  "handledById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- The operator's queue: everything unanswered, oldest first.
CREATE INDEX "SupportRequest_handledAt_createdAt_idx" ON "SupportRequest"("handledAt", "createdAt");
-- One hotel's own history.
CREATE INDEX "SupportRequest_tenantId_createdAt_idx" ON "SupportRequest"("tenantId", "createdAt");

-- SET NULL rather than CASCADE: a property being removed must not delete the record that somebody
-- asked for help about it. The report is evidence, and it outlives the thing it was about.
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A hotel may read its own requests and nothing else. The operator reads across tenants through the
-- system perimeter, exactly like every other cross-tenant screen in the console.
ALTER TABLE "SupportRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SupportRequest"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
