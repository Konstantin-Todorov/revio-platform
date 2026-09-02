-- The plan tier becomes DERIVED; this is the reasoned exception to it.
--
-- `Tenant.plan` was a free dropdown with a Save button, while Plans & pricing ran a whole panel
-- detecting that the billed tier disagreed with the room count. The console was manufacturing the
-- problem it then measured — and a hotel that opened a second building stayed on Starter forever,
-- because nothing moved the value and nobody was told.
--
-- Tier is now computed from rooms. An override still exists, because a negotiated deal or a group
-- ramping up are real, but it has to carry a reason and a name: then "unbilled tier drift" stops
-- being a number somebody must remember to check and becomes an exception with a date attached.
--
-- `plan` is left in place: it still records what the tenant was last billed on, and dropping a
-- column that invoices were generated from is not something to do in the same change as this.
ALTER TABLE "Tenant" ADD COLUMN "planOverride"       TEXT;
ALTER TABLE "Tenant" ADD COLUMN "planOverrideReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "planOverrideById"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN "planOverrideAt"     TIMESTAMP(3);
