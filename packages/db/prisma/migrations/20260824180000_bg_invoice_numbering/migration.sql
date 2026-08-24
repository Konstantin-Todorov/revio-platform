-- Invoice numbers that Bulgarian law actually accepts.
--
-- The format shipped this morning was `REV-2026-0001`. ЗДДС чл. 114, ал. 1, т. 2 and ППЗДДС чл. 78
-- require "пореден десетразряден номер, съдържащ само арабски цифри" — a sequential TEN-DIGIT number
-- containing only Arabic numerals, ascending, without duplication and without gaps. That format
-- fails on three counts at once: it contains letters, it contains separators, and it restarts every
-- January, which guarantees a duplicate in year two.
--
-- Caught before a single number was issued (5 invoices in production, 0 with a number), which is the
-- only comfortable time to find it: a number that has been on a document sent to a customer cannot
-- be withdrawn, renumbered, or skipped.
--
-- The law explicitly permits several ranges for one taxable person "според нуждите на данъчно
-- задълженото лице", so the software takes a range well clear of the books kept by hand — 1000000000
-- upward, leaving 0000000001–0999999999 where it is.

-- 1. The starting point of our range, on the company record. BigInt because a ten-digit number
--    reaches 9999999999 and a 32-bit integer stops at 2147483647 — a silent overflow in the one
--    field where being quietly wrong is unrecoverable.
ALTER TABLE "OperatorCompany" DROP COLUMN "invoicePrefix";
ALTER TABLE "OperatorCompany" ADD COLUMN "invoiceNumberStart" BIGINT NOT NULL DEFAULT 1000000000;

-- 2. The counter, rebuilt. Not keyed by year: Bulgarian numbering is one continuous ascending run for
--    the life of the company, so a year in the key IS the duplicate. Safe to drop and recreate
--    because nothing has ever been issued; if that were not true this would have to be a data
--    migration, and the old numbers would have to stand.
DROP TABLE IF EXISTS "OperatorInvoiceSeries";
CREATE TABLE "OperatorInvoiceSeries" (
  "id"         TEXT NOT NULL,
  -- "real" or "demo". Demo tenants are billed like real ones so the flow stays testable, and must
  -- never draw from the legally-sequenced range.
  "kind"       TEXT NOT NULL,
  "nextNumber" BIGINT NOT NULL,
  CONSTRAINT "OperatorInvoiceSeries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorInvoiceSeries_kind_key" ON "OperatorInvoiceSeries"("kind");

ALTER TABLE "OperatorInvoiceSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorInvoiceSeries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "OperatorInvoiceSeries";
CREATE POLICY operator_only ON "OperatorInvoiceSeries"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
