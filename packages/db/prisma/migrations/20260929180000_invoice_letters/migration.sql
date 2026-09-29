-- Invoices in the customer's language, sent and chased automatically, payable from a page that never expires.
ALTER TABLE "Invoice" ADD COLUMN "language" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuerRepresentative" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "buyerRepresentative" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuePlace" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "payToken" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "emailedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "remindersSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Invoice_payToken_key" ON "Invoice"("payToken");
ALTER TABLE "ClientBilling" ADD COLUMN "representative" TEXT;
ALTER TABLE "OperatorCompany" ADD COLUMN "representative" TEXT;
ALTER TABLE "OperatorCompany" ADD COLUMN "autoSendInvoices" BOOLEAN NOT NULL DEFAULT true;
