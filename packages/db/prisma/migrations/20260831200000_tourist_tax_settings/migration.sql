-- Туристически данък settings (ЗМДТ чл. 61с).
--
-- Both nullable and both without a default, deliberately. The rate is set by each municipal council
-- per settlement and per category, and the bed base is a figure the hotel agreed with its
-- municipality. A default on either would be a number somebody eventually files as though we knew
-- it — and this tax is assessed by the municipality from ЕСТИ data (чл. 61с ал. 2), so a wrong
-- figure here is not a private mistake.
ALTER TABLE "PropertyDefaults" ADD COLUMN "touristTaxRateMinor" INTEGER;
ALTER TABLE "PropertyDefaults" ADD COLUMN "touristTaxBeds" INTEGER;
