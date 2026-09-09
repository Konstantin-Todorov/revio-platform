-- Paying an invoice by card.
--
-- Stripe is a payment RAIL against our own invoice, never an invoicing system. Stripe Invoicing
-- would issue documents under its own numbering, and Bulgarian law wants one gapless ascending run
-- per company (see "OperatorInvoiceSeries") — a second source of invoice numbers is a compliance
-- defect, not a convenience.

ALTER TABLE "Invoice"
  ADD COLUMN "paidVia"               TEXT,
  ADD COLUMN "stripeSessionId"       TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeMode"            TEXT,
  ADD COLUMN "stripeCheckoutUrl"     TEXT,
  ADD COLUMN "stripeCheckoutExpires" TIMESTAMP(3);

-- A Checkout Session belongs to exactly one invoice. The uniqueness is not tidiness: it is what
-- makes the webhook's lookup unambiguous, so a replayed or forged event cannot be pointed at a
-- different invoice than the one the session was created for.
CREATE UNIQUE INDEX "Invoice_stripeSessionId_key" ON "Invoice"("stripeSessionId");

-- Every invoice already paid was paid by bank transfer and marked by hand. Say so, rather than
-- leaving them null and indistinguishable from "paid somehow, nobody recorded how".
UPDATE "Invoice" SET "paidVia" = 'manual' WHERE "status" = 'paid';
