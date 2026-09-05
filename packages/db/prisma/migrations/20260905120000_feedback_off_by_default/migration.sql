-- Guest feedback is ON HOLD. Make "off" the state of the world, not merely the intention.
--
-- The feature is not being shipped: soliciting reviews from guests acquired through an OTA sits
-- inside those OTAs' contracts (Booking.com, Trip.com, Expedia and others each restrict contacting
-- and marketing to guests they introduced), and the founder's call on 2026-09-05 was that the
-- contractual surface is not worth the feature. See docs/specs/REVIEW-REQUESTS.md for the full
-- decision record.
--
-- ⚠️ WHY THIS MIGRATION EXISTS AT ALL, when the sender was never built.
--
-- `feedbackEnabled` shipped with DEFAULT true, chosen when the feature was going to ship. Nothing
-- reads it today. But a column that says `true` on every property is a loaded gun pointed at the
-- future: the day somebody wires a sender, every hotel on the platform is already opted in — by a
-- default set before the decision to hold, not by anyone choosing it.
--
-- So the off state is made explicit and durable rather than left implied by the absence of a caller.
-- The columns and the (empty) GuestFeedback table are deliberately KEPT: dropping them is a
-- destructive migration against a live database for no benefit, and the work is likely to return in
-- a narrower, direct-bookings-only form.

ALTER TABLE "Property" ALTER COLUMN "feedbackEnabled" SET DEFAULT false;

-- Every existing row, so no property carries an "on" it never chose. There is no data to lose:
-- nothing has ever read this column and GuestFeedback is empty.
UPDATE "Property" SET "feedbackEnabled" = false WHERE "feedbackEnabled" = true;
