-- Who settled an invoice, and against what.
--
-- `setInvoiceStatus` accepted any status from any status with no record of who did it: draft could
-- be marked paid directly, a paid invoice could be dragged back to draft, and nothing anywhere said
-- who had done either. In a ledger that is not a display bug.
--
-- Found in production: `Hotel Sofia · 2026-07` sits at **paid with no invoice number and no
-- issuedAt** — a document that was settled without ever having been issued.
ALTER TABLE "Invoice" ADD COLUMN "paidById"      TEXT;
ALTER TABLE "Invoice" ADD COLUMN "paidReference" TEXT;
