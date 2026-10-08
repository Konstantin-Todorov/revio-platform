-- Guest-facing legal hygiene (2026-10-08). Additive and nullable throughout: no existing row changes.
-- A guest can opt out of the hotel's promotional mail ("Before arrival" / "After departure").
ALTER TABLE "Guest" ADD COLUMN "marketingOptOutAt" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN "emailPrefsToken" TEXT;
CREATE UNIQUE INDEX "Guest_emailPrefsToken_key" ON "Guest"("emailPrefsToken");
-- The hotel's own privacy policy for its RevioDirect page; null = the generated notice.
ALTER TABLE "Property" ADD COLUMN "bookingPrivacyUrl" TEXT;
