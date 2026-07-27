-- The booking engine's own presentation, separate from the email engine's.
--
-- NULLable on purpose: NULL means "inherit from the email branding", so every existing property
-- keeps exactly the look it has today and only the fields a hotel actually edits diverge. The two
-- non-null columns get defaults that match what the engine already renders, so this migration
-- changes nothing visually until someone opens the new screen.
ALTER TABLE "Property"
  ADD COLUMN "bookingPreset"      TEXT    NOT NULL DEFAULT 'clean',
  ADD COLUMN "bookingBrandColor"  TEXT,
  ADD COLUMN "bookingFont"        TEXT,
  ADD COLUMN "bookingLogoUrl"     TEXT,
  ADD COLUMN "bookingHeadline"    TEXT,
  ADD COLUMN "bookingSubheadline" TEXT,
  ADD COLUMN "bookingShowTrust"   BOOLEAN NOT NULL DEFAULT true;
