-- BG1: the booking page's hero background photograph.
--
-- Additive and entirely nullable/defaulted, so it applies to a live database with reservations in it
-- without touching a single existing row: every property comes out of this migration with no hero,
-- which is exactly the state they are in today.
--
-- Only KEYS live here. The bytes go to object storage through @revio/storage — the same rule as
-- RoomTypePhoto, for the same arithmetic (see packages/storage/CLAUDE.md). A hero is the largest
-- image in the product; putting it in the row store would put a megabyte per property into every
-- backup and route every guest's first paint through the Next server.
--
-- `bookingHeroLuminance` is the one column here that is not obviously presentation: it records how
-- bright the photograph measured at upload, so the overlay that keeps the headline readable can be
-- COMPUTED (packages/core/src/booking/hero.ts) instead of being a number somebody chose once.

ALTER TABLE "Property"
  ADD COLUMN "bookingHeroKey"       TEXT,
  ADD COLUMN "bookingHeroThumbKey"  TEXT,
  ADD COLUMN "bookingHeroWidth"     INTEGER,
  ADD COLUMN "bookingHeroHeight"    INTEGER,
  ADD COLUMN "bookingHeroLuminance" INTEGER,
  ADD COLUMN "bookingHeroFocalY"    INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "bookingHeroOverlay"   TEXT    NOT NULL DEFAULT 'balanced';

-- No GRANT and no RLS statement here on purpose: these are columns on a table that already has both.
-- "Property" carries `tenant_isolation` and `revio_app` already holds SELECT/UPDATE on it, and
-- column-level privileges were never used — so a grant here would either be a no-op or, worse, imply
-- a per-column model this schema does not have.
