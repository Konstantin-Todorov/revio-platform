-- Guest feedback after a stay (docs/specs/REVIEW-REQUESTS.md).
--
-- The post-stay email already goes out and currently asks for nothing measurable. This is the row
-- behind one question with five one-click answers, and the internal routing that follows.
--
-- ⚠️ THE RULE THIS TABLE IS SHAPED BY: the rating decides who is told internally and how fast. It
-- NEVER decides who is shown the public review links. Filtering the public ask by sentiment is
-- review gating — Google's policies prohibit soliciting reviews selectively, regulators treat it as
-- deceptive, and the risk lands on the hotel rather than on us. `publicPromptShown` exists as an
-- AUDIT TRAIL proving we showed them, not as a switch for hiding them. The rules live in
-- `@revio/core/feedback` (35 tests), including a test that fails if anyone ever gates it.

CREATE TABLE "GuestFeedback" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,

  -- Feedback with no stay is not feedback, so this is required — which is also why the foreign key
  -- below cascades rather than nulling: there is no such thing as an orphaned row here.
  "reservationId" TEXT NOT NULL,
  -- Null when the stay carried no guest profile. We still want the rating.
  "guestId"       TEXT,

  -- NULL until they answer. The row exists from the moment we ASK, so "asked and stayed silent" is a
  -- fact we can count rather than an absence we have to infer from a missing row.
  "rating"        INTEGER,
  "comment"       TEXT,

  "askedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt"   TIMESTAMP(3),
  -- Set when a person has dealt with a low rating. Drives the Action Center's count of things that
  -- still need someone.
  "resolvedAt"    TIMESTAMP(3),

  -- Single-use link in the email. Answering takes no login and no typing, which is most of why
  -- anybody answers at all.
  "token"          TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,

  -- Always true today. Kept so that if gating is ever shipped, there is a record of when it started.
  "publicPromptShown" BOOLEAN NOT NULL DEFAULT true,

  -- post_stay | manual
  "source"        TEXT NOT NULL DEFAULT 'post_stay',
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestFeedback_pkey" PRIMARY KEY ("id")
);

-- ⚠️ ONE ROW PER RESERVATION. A guest who clicks two stars and then five has changed their mind, not
-- left two reviews: the row is updated. Two rows would double-count the hotel's average, which is
-- precisely the number they will quote back at us.
CREATE UNIQUE INDEX "GuestFeedback_reservationId_key" ON "GuestFeedback"("reservationId");
CREATE UNIQUE INDEX "GuestFeedback_token_key" ON "GuestFeedback"("token");

-- The inbox and the average, both scoped to a property and a period.
CREATE INDEX "GuestFeedback_propertyId_respondedAt_idx" ON "GuestFeedback"("propertyId", "respondedAt");
-- "How many unresolved one- and two-star answers are there?" — the Action Center's question.
CREATE INDEX "GuestFeedback_propertyId_rating_resolvedAt_idx" ON "GuestFeedback"("propertyId", "rating", "resolvedAt");
-- "When did we last ask THIS guest?" — the suppression window that stops a monthly regular being
-- asked monthly.
CREATE INDEX "GuestFeedback_guestId_askedAt_idx" ON "GuestFeedback"("guestId", "askedAt");

ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL rather than CASCADE: a guest profile being merged away must not delete the rating. GDPR
-- erasure anonymises in place and never deletes, so this is the merge path more than the erasure one.
ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A guest's opinion of a hotel, in their own words. Same enforcement as everything else.
ALTER TABLE "GuestFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GuestFeedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "GuestFeedback"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
