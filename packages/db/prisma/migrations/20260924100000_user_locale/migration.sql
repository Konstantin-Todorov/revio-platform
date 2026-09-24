-- The language a person reads the staff products in. Nullable: null means English, so every
-- existing account is unchanged by this migration.
ALTER TABLE "User" ADD COLUMN "locale" TEXT;
