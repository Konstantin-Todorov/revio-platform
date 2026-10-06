-- The tourist tax rate becomes ONE row per property (`@revio/db` tourist-tax.ts).
--
-- RevioPMS kept its own copy in PropertyDefaults.touristTaxRateMinor for the council register, while
-- guests were charged from the TaxFee "City tax" row. A property that stated the rate ONLY in RevioPMS
-- gets that rate as its tourist-tax row now; where both exist the TaxFee row stays (it is what guests
-- were actually charged). The old column is no longer read or written, and is kept until a later
-- migration drops it, so a rolling deploy never meets a missing column.
INSERT INTO "TaxFee" ("id", "tenantId", "propertyId", "name", "type", "amountMinor", "basis", "inclusion", "active")
SELECT gen_random_uuid()::text, d."tenantId", d."propertyId", 'City tax', 'fixed', d."touristTaxRateMinor", 'per_person_night', 'excluded', true
FROM "PropertyDefaults" d
WHERE d."touristTaxRateMinor" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "TaxFee" t
    WHERE t."propertyId" = d."propertyId" AND t."active" AND t."type" = 'fixed' AND t."basis" IN ('per_person_night', 'per_person')
  );
