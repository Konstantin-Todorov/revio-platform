-- Money that came back, or is being argued about (Stripe review §S2).
--
-- Until now a refund or a dispute in Stripe left `Invoice.status = 'paid'` and nothing anywhere said
-- otherwise. Our books and Stripe's would disagree, silently, and the first anybody would know is a
-- bank balance that did not match.
--
-- ⚠️ `status` deliberately does NOT move back off 'paid'. The invoice records a supply that happened
-- and a payment that happened, and both stay true after the money is returned. A refund is a later
-- fact recorded beside it, not an undoing of it — which is why these are separate columns rather
-- than another meaning loaded onto a field that already has one.
--
-- Issuing a credit note is deliberately NOT done here: that is a legal document with its own
-- numbering and its own rules, and whether one is required is the accountant's call.
ALTER TABLE "Invoice"
  ADD COLUMN "refundedMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAt"    TIMESTAMP(3),
  ADD COLUMN "disputeStatus" TEXT,
  ADD COLUMN "disputedAt"    TIMESTAMP(3);

-- Finding the invoice a refund belongs to means looking it up by the payment intent Stripe names in
-- the event. Without this that is a sequential scan on every refund.
CREATE INDEX "Invoice_stripePaymentIntentId_idx" ON "Invoice"("stripePaymentIntentId");
