-- Stripe Connect per property (booking-engine spec §2.5③).
--
-- Additive and nullable: every existing property keeps working, in request-to-book mode, until it
-- connects an account. `chargesEnabled` defaults false deliberately — the safe state is "cannot take
-- a card", so a mis-set flag degrades to asking the hotel to confirm rather than to promising a
-- guarantee that was never taken.
ALTER TABLE "Property" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Property" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "stripeCheckedAt" TIMESTAMP(3);

-- One Stripe account belongs to at most one property: two properties sharing an account would send
-- one hotel's guarantees to another's balance.
CREATE UNIQUE INDEX "Property_stripeAccountId_key" ON "Property"("stripeAccountId");
