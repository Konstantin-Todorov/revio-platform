-- Step two of retiring PropertyDefaults.touristTaxRateMinor. Step one (20261006120000 + the @ignore)
-- moved the rate onto the tourist-tax TaxFee row and stopped every client reading the column; that
-- code is live, so no running instance selects it any more and dropping it cannot break a rollout.
ALTER TABLE "PropertyDefaults" DROP COLUMN IF EXISTS "touristTaxRateMinor";
