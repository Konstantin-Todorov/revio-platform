-- Lead: record when an enquiry was emailed a link to start the free trial themselves.
--
-- Both columns are nullable with no default and no backfill, so this is additive: existing rows
-- read as "not offered a trial yet", which is exactly what they are.
ALTER TABLE "Lead" ADD COLUMN "trialSentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "trialSentById" TEXT;
