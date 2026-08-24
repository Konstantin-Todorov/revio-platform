-- Demo tenants must not consume real invoice numbers.
--
-- Hotel Sofia Group and Black Sea Resort live in production permanently and are billed like real
-- clients, deliberately, so the billing flow stays testable end to end. With one counter per year
-- that testability had a price nobody would notice until it was permanent: rehearsing the flow three
-- times means the first REAL customer is invoiced REV-2026-0004, and an invoice sequence with three
-- missing documents in it is a question from an auditor, not a cosmetic detail.
--
-- Numbers cannot be reclaimed, so this has to be right before the first issue rather than after.
-- The counter is now keyed by (prefix, year); demo tenants issue under "DEMO" and the real series
-- stays untouched at REV-2026-0001.

ALTER TABLE "OperatorInvoiceSeries" ADD COLUMN "prefix" TEXT NOT NULL DEFAULT 'REV';

DROP INDEX IF EXISTS "OperatorInvoiceSeries_year_key";
CREATE UNIQUE INDEX "OperatorInvoiceSeries_prefix_year_key" ON "OperatorInvoiceSeries"("prefix", "year");
