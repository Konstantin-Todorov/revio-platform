-- A hotel can now fill in its own company details for the invoices we issue it, from the billing
-- section inside its own product. This records when they last did — which is not the same fact as
-- `updatedAt`, because that moves when WE edit the row too.
--
-- It is worth its own column rather than being inferred: an operator looking at a client page needs
-- to know whether the legal name in front of them is the customer's own answer or our transcription
-- of something said on a phone call. Those are different levels of confidence in a tax document.
ALTER TABLE "ClientBilling" ADD COLUMN "selfServedAt" TIMESTAMP(3);
