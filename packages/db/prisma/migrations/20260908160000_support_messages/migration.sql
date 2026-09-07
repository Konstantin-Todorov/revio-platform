-- The exchange, not just the question.
--
-- A support request was a one-way record: the hotel asked, and the answer happened somewhere else —
-- in an inbox, on a phone call — leaving the system with half the story. "What did we tell them last
-- time" meant searching a sent folder, and the hotel had no way to see their own history at all.
--
-- ⚠️ THE SYSTEM IS THE RECORD; EMAIL IS THE DELIVERY. Nobody logs into a portal to check whether
-- support replied, so every message from us is emailed as well as stored. `emailedAt` records
-- whether that actually happened: a reply the hotel never received is indistinguishable from being
-- ignored, and that is the failure this feature exists to prevent.
--
-- No RLS policy of its own: a message is reachable only through its request, which is already
-- tenant-isolated, and the app always reads it by requestId. Adding a second policy that has to stay
-- in agreement with the first is a way for the two to disagree.

CREATE TABLE "SupportMessage" (
  "id"         TEXT NOT NULL,
  "requestId"  TEXT NOT NULL,
  -- hotel | revio
  "side"       TEXT NOT NULL,
  -- Copied at the time of writing, so the thread still reads correctly after an account changes.
  "authorName" TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  -- Null means the email did not go out. Only meaningful for side = 'revio'.
  "emailedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_requestId_createdAt_idx" ON "SupportMessage"("requestId", "createdAt");

-- CASCADE: a thread has no meaning without the request it belongs to.
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" FORCE ROW LEVEL SECURITY;
-- Reachable only through a request the tenant can already see. The subquery is the isolation.
CREATE POLICY tenant_isolation ON "SupportMessage"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "SupportRequest" r
      WHERE r.id = "SupportMessage"."requestId"
        AND r."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "SupportRequest" r
      WHERE r.id = "SupportMessage"."requestId"
        AND r."tenantId" = current_setting('app.tenant_id', true)
    )
  );
