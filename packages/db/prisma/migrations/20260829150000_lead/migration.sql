-- Website demo requests, stored rather than only emailed.
--
-- Every notification WAS delivered; the founder still could not find them. A mail client is a
-- notification channel, not a record. This is the place to look.
CREATE TABLE "Lead" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "company"       TEXT,
  "rooms"         TEXT,
  "currentSystem" TEXT,
  "channels"      TEXT,
  "interestedIn"  TEXT,
  "message"       TEXT,
  "quote"         TEXT,
  "page"          TEXT,
  "utmSource"     TEXT,
  "utmMedium"     TEXT,
  "utmCampaign"   TEXT,
  "referrer"      TEXT,
  "handledAt"     TIMESTAMP(3),
  "handledById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_handledAt_idx" ON "Lead"("handledAt");

-- Ours about a prospect, never a hotel's own data — so bypass-only, the same perimeter as
-- ConnectivityCredential and Invoice. A hotel connection must never see who else is enquiring.
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "Lead"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
