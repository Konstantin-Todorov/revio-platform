-- Close Day escalation settings (round-2 §3.4).
--
-- A business day that is not closed stays open and still due, so unclosed days accumulate: miss
-- seven and the eighth needs closing seven times. Two stages fix that — remind, then close it
-- automatically — and both timings are per-property, because the business-day boundary already
-- varies (some properties audit at 03:00, some at midnight) and one fixed time would fit nobody.
ALTER TABLE "PropertyDefaults" ADD COLUMN "closeDeadlineMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "PropertyDefaults" ADD COLUMN "closeReminderWindowHours" INTEGER NOT NULL DEFAULT 22;
ALTER TABLE "PropertyDefaults" ADD COLUMN "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Who closed the day, and whether anybody did. A run of system-closed days is itself a signal that
-- nobody is minding the desk, and that is only readable if the actor is recorded rather than assumed.
ALTER TABLE "Property" ADD COLUMN "lastCloseWasAutomatic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "lastClosedAt" TIMESTAMP(3);
