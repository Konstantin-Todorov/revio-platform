-- A booking-engine hold can now say that it IS one, and which browsing session it belonged to.
--
-- Both exist to make one number honest: the direct-booking conversion rate.
--
-- `source` replaces an inference. "createdById IS NULL means a guest" is true today and quietly
-- wrong the first time anything else creates a hold without a user, and a metric that is wrong
-- without erroring is worse than no metric.
--
-- `sessionId` is the one that changes the number rather than protecting it. A guest who opens one
-- room, goes back and books a different one leaves the first hold to expire — so one person making
-- one booking currently reads as one conversion AND one abandonment. Grouped by session, that is
-- one session that converted, which is what happened.
-- ⚠️ `Hold` is under FORCE ROW LEVEL SECURITY, which binds the table OWNER too — only a superuser
-- is exempt. If the role running migrations is not one, an unqualified UPDATE below would match
-- zero rows and report success, which is the fail-closed-and-silent behaviour that has already cost
-- this project real incidents. The policy's own escape hatch is `app.bypass`, so the backfill says
-- explicitly that it means every tenant. Transaction-local (`true`), so it cannot leak past this
-- migration, and harmless if the role never needed it.
SELECT set_config('app.bypass', 'on', true);

ALTER TABLE "Hold" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE "Hold" ADD COLUMN "sessionId" TEXT;

-- Backfill, INFERRED rather than recorded: every hold made before this migration with no creator
-- came from the public engine, because the engine is the only caller that passes none. It is the
-- best available answer for existing rows and it is not evidence — the funnel screen says so for
-- any date before this migration rather than presenting inferred history as measured history.
UPDATE "Hold" SET "source" = 'booking_engine' WHERE "createdById" IS NULL;

CREATE INDEX "Hold_propertyId_source_createdAt_idx" ON "Hold"("propertyId", "source", "createdAt");
