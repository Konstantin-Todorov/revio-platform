-- The company's name in both scripts.
--
-- "Уебър БГ ЕООД" and "WEBER BG EOOD" are both official renderings of the same registered entity —
-- not a translation, and neither is more correct than the other. Which one belongs on an invoice
-- depends on who is receiving it: a Bulgarian customer's accountant expects the Cyrillic name that
-- matches the commercial register, and a German customer cannot file a document they cannot read.
--
-- Address travels with the name. An invoice carrying "WEBER BG EOOD" above "ул. Преслав 6, Русе"
-- reads as two different companies, which is precisely the doubt an invoice must not create.
--
-- Nullable: a company with only one rendering leaves these empty and every invoice uses the primary.
ALTER TABLE "OperatorCompany"
  ADD COLUMN "legalNameLatin"   TEXT,
  ADD COLUMN "addressLineLatin" TEXT,
  ADD COLUMN "cityLatin"        TEXT;
