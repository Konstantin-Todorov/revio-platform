-- Where a guest is sent to leave a public review, and when we ask.
--
-- ⚠️ Booking.com is deliberately absent and always will be: they send their own invitation and do not
-- permit third parties to collect reviews for their platform. Saying so on the settings screen
-- prevents both a support question and a false expectation.
--
-- ⚠️ There is NO "only ask guests who rated well" column here, and there must never be one. Filtering
-- the public ask by sentiment is review gating: Google's policies prohibit soliciting reviews
-- selectively, regulators treat it as a deceptive practice, and the consequence lands on the HOTEL's
-- listing rather than on us. The rating decides who is told internally and how fast — nothing else.
-- `@revio/core/feedback` holds that rule and a test fails if anyone changes it.

ALTER TABLE "Property"
  ADD COLUMN "reviewGoogleUrl"        TEXT,
  ADD COLUMN "reviewTripadvisorUrl"   TEXT,
  ADD COLUMN "reviewOwnUrl"           TEXT,
  ADD COLUMN "feedbackEnabled"        BOOLEAN NOT NULL DEFAULT true,
  -- Days after departure. 1 by default: soon enough that the stay is fresh, late enough that they
  -- are home rather than in a taxi.
  ADD COLUMN "feedbackAskAfterDays"   INTEGER NOT NULL DEFAULT 1,
  -- A guest who stays monthly must not be asked monthly.
  ADD COLUMN "feedbackAskEveryMonths" INTEGER NOT NULL DEFAULT 6,
  -- NULL falls back to reservationEmailPrimary, so a hotel that has already told us where bookings
  -- go does not have to tell us again.
  ADD COLUMN "feedbackAlertEmail"     TEXT;
