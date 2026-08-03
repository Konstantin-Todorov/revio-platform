-- Extras a guest can add while booking (K10).
--
-- Deliberately NOT a new catalogue. The booking-engine spec §5 says "no upsell engine beyond the
-- stay-extras the PMS already defines", so this reuses the catalogue the PMS already has and adds
-- the one thing it was missing: whether an item is offered to a guest as well as to the front desk.
--
-- `directSellable` defaults FALSE so no existing item silently appears on a public page. A hotel's
-- internal catalogue contains staff-only lines, and the safe default for "who can see this" is
-- nobody new.
ALTER TABLE "PosItem" ADD COLUMN "directSellable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PosItem" ADD COLUMN "basis" TEXT NOT NULL DEFAULT 'per_stay';
ALTER TABLE "PosItem" ADD COLUMN "description" TEXT;

-- `per_night` on StayExtra preserves today's behaviour exactly: every existing row keeps accruing
-- once per night audit. `per_stay` is the new case and posts once.
ALTER TABLE "StayExtra" ADD COLUMN "basis" TEXT NOT NULL DEFAULT 'per_night';
