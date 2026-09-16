-- When a product was first opened — which is when its trial actually starts.
--
-- Signing up switched on all three products and started three clocks at the same instant. A hotel
-- that spent its first fortnight in RevioLink — the sensible way to start — opened RevioCRS on day
-- fifteen with fifteen days left, and RevioPMS on day twenty-two with eight. Three trials were
-- advertised and one was delivered.
--
-- `openedAt` is the fact that fixes it: the clock now runs 30 days from here (see `trialClock` in
-- @revio/core), and a product that was never opened is an invitation rather than a countdown.
--
-- ⚠️ BACKFILLED to `startedAt`, deliberately, rather than left null.
--
-- Null would mean "never opened" to every reader, so every existing trial would silently become an
-- unstarted one — a running trial would stop counting down and a finished one would come back to
-- life. Existing rows were created at activation and their clocks have been running since; copying
-- `startedAt` keeps them exactly as they are. Nobody's trial moves because of this migration.
ALTER TABLE "ProductTrial" ADD COLUMN "openedAt" TIMESTAMP(3);
UPDATE "ProductTrial" SET "openedAt" = "startedAt" WHERE "openedAt" IS NULL;
