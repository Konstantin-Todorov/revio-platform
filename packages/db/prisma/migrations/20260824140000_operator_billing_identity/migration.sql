-- Being able to invoice a real client.
--
-- Until now an "invoice" was a row: tenant, period, amount, and a sentence of line items. There was
-- no number, no issuer, no VAT treatment and no document — our own company name appeared nowhere in
-- the codebase. The hotel-facing side of the platform has issued proper tax documents for months
-- (TaxInvoice: gapless numbering, issuer snapshot, per-rate tax summary); the side that bills the
-- hotels could not produce a single one. That is the gap between a working product and a business.
--
-- Three additions, mirroring the discipline TaxInvoice already uses.

-- 1. Our own legal identity. One row. A table rather than environment variables because an address
--    or a bank account should be correctable without a deploy, and because it has to be snapshotted
--    onto each invoice regardless.
CREATE TABLE "OperatorCompany" (
  "id"               TEXT NOT NULL DEFAULT 'singleton',
  "legalName"        TEXT NOT NULL,
  "vatId"            TEXT,
  "companyId"        TEXT,
  "addressLine"      TEXT,
  "city"             TEXT,
  "postCode"         TEXT,
  "country"          TEXT NOT NULL DEFAULT 'BG',
  "email"            TEXT,
  "phone"            TEXT,
  "website"          TEXT,
  "iban"             TEXT,
  "bic"              TEXT,
  "bankName"         TEXT,
  "standardVatPct"   INTEGER NOT NULL DEFAULT 20,
  "invoicePrefix"    TEXT NOT NULL DEFAULT 'REV',
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 14,
  "footerNote"       TEXT,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatorCompany_pkey" PRIMARY KEY ("id")
);

-- 2. Gapless numbering, one counter per year. Claimed with a single atomic increment so two invoices
--    issued in the same second cannot collide. A gap or a duplicate in an invoice sequence is an
--    audit finding, not a cosmetic bug.
CREATE TABLE "OperatorInvoiceSeries" (
  "id"         TEXT NOT NULL,
  "year"       INTEGER NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OperatorInvoiceSeries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatorInvoiceSeries_year_key" ON "OperatorInvoiceSeries"("year");

-- 3. The client's legal identity. Separate from ClientAccount on purpose: that table holds what we
--    BELIEVE about a relationship, this holds facts printed on a tax document. Its absence means
--    something precise — this client cannot be invoiced yet.
CREATE TABLE "ClientBilling" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "legalName"    TEXT NOT NULL,
  "vatId"        TEXT,
  "companyId"    TEXT,
  "addressLine"  TEXT,
  "city"         TEXT,
  "postCode"     TEXT,
  "country"      TEXT,
  "billingEmail" TEXT,
  "attention"    TEXT,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientBilling_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientBilling_tenantId_key" ON "ClientBilling"("tenantId");
ALTER TABLE "ClientBilling" ADD CONSTRAINT "ClientBilling_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. The issued document, on the existing Invoice row.
--
--    All nullable, and that is load-bearing rather than lazy: NULL means "still a draft". Issuing is
--    the transition that allocates the number and freezes the snapshot, so `number IS NULL` and
--    "not yet issued" are the same statement and cannot drift apart.
--
--    Snapshots rather than joins. Our bank account and the customer's VAT number both change, and a
--    document that silently reprints with today's details is no longer the document that was sent.
ALTER TABLE "Invoice"
  ADD COLUMN "number"          TEXT,
  ADD COLUMN "issuedAt"        TIMESTAMP(3),
  ADD COLUMN "dueDate"         TIMESTAMP(3),
  ADD COLUMN "issuerName"      TEXT,
  ADD COLUMN "issuerVatId"     TEXT,
  ADD COLUMN "issuerCompanyId" TEXT,
  ADD COLUMN "issuerAddress"   TEXT,
  ADD COLUMN "issuerIban"      TEXT,
  ADD COLUMN "issuerBic"       TEXT,
  ADD COLUMN "issuerBankName"  TEXT,
  ADD COLUMN "buyerName"       TEXT,
  ADD COLUMN "buyerVatId"      TEXT,
  ADD COLUMN "buyerCompanyId"  TEXT,
  ADD COLUMN "buyerAddress"    TEXT,
  ADD COLUMN "netMinor"        INTEGER,
  ADD COLUMN "taxMinor"        INTEGER,
  ADD COLUMN "grossMinor"      INTEGER,
  ADD COLUMN "vatRatePct"      INTEGER,
  ADD COLUMN "vatTreatment"    TEXT,
  ADD COLUMN "vatNote"         TEXT,
  ADD COLUMN "lineSnapshot"    JSONB;

CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- RLS: all three are OURS. Same `operator_only` policy Invoice, ConnectivityCredential and the CRM
-- tables already carry — rows exist only under `app.bypass = 'on'`.
--
-- ClientBilling matters most here. It carries a customer's registered company name, VAT number and
-- address, and it is keyed by tenant, so it is exactly the shape of table an application bug could
-- leak ACROSS tenants: one hotel reading another hotel's legal and financial details. The operator
-- console reaches it only through forSystem(), so the policy costs nothing and closes that off at
-- the database instead of relying on every future query remembering to filter.
ALTER TABLE "OperatorCompany" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorCompany" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "OperatorCompany";
CREATE POLICY operator_only ON "OperatorCompany"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');

ALTER TABLE "OperatorInvoiceSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatorInvoiceSeries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "OperatorInvoiceSeries";
CREATE POLICY operator_only ON "OperatorInvoiceSeries"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');

ALTER TABLE "ClientBilling" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientBilling" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "ClientBilling";
CREATE POLICY operator_only ON "ClientBilling"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
