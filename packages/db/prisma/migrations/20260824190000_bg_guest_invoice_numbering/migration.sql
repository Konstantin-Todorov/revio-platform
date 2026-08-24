-- The same legal defect, on the documents hotels give their GUESTS.
--
-- The operator-side fix (20260824180000) corrected the invoices we send hotels. This is the other
-- side of the same law and the one that reaches further: every guest invoice a Bulgarian property
-- issues through RevioPMS was numbered `INV-2026-0001`, which ЗДДС чл. 114, ал. 1, т. 2 does not
-- accept — letters, separators, four digits, and a reset each January.
--
-- Not hardcoded to Bulgaria. `PropertyDefaults.invoiceNumberScheme` picks the rule per property,
-- because the numbering format is the single most country-specific thing about an invoice and
-- baking ours in would make every foreign hotel non-compliant instead of only the Bulgarian ones.
-- The default is `bg_10digit` because that is the market being sold to.

ALTER TABLE "PropertyDefaults"
  ADD COLUMN "invoiceNumberScheme" TEXT   NOT NULL DEFAULT 'bg_10digit',
  ADD COLUMN "invoiceNumberStart"  BIGINT NOT NULL DEFAULT 1000000000;

-- Ten digits reach 9999999999; a 32-bit integer stops at 2147483647. Widening is lossless.
ALTER TABLE "InvoiceSeries" ALTER COLUMN "nextNumber" TYPE BIGINT;

-- Under the Bulgarian scheme an известие (credit note) is a данъчен документ exactly as a фактура is,
-- and "без дублиране" applies across all of a taxable person's documents — so both draw from ONE
-- ascending range per property. A proforma is not a tax document and keeps its own separate run.
--
-- Existing rows are left under their old docType. Two demo documents exist (INV-2026-0001,
-- CN-2026-0001) and no real property has issued anything, so nothing has to be renumbered — and
-- renumbering an issued document is precisely what the rule forbids, demo or not.
