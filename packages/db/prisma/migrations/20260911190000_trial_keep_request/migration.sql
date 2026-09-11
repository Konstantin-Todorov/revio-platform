-- A hotel asking to keep a trial is the strongest buying signal this platform produces, and until
-- now there was nowhere to put it. The trial banner in the hotel's own product offers "Keep it";
-- this is where that press is recorded, so the operator sees it on the client page instead of
-- finding it in a support inbox, and so the banner stops asking once it has been asked.
--
-- Deliberately NOT a status change. The trial keeps running to its own end date and the entitlement
-- keeps its expiry; converting to paid stays a separate, deliberate act by an operator (see
-- `@revio/core` trials: "a trial must never become a charge on its own"). This column records that
-- the customer asked — nothing more.
ALTER TABLE "ProductTrial" ADD COLUMN "keepRequestedAt" TIMESTAMP(3);

-- Who pressed it. A request with nobody's name on it is not a decision, and the operator ringing
-- back needs to know which person at the hotel to ask for.
ALTER TABLE "ProductTrial" ADD COLUMN "keepRequestedById" TEXT;
