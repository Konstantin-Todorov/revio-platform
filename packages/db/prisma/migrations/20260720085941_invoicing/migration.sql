-- AlterTable
ALTER TABLE "PropertyDefaults" ADD COLUMN     "invoiceAddress" TEXT,
ADD COLUMN     "invoiceIssuerName" TEXT,
ADD COLUMN     "invoiceVatId" TEXT,
ADD COLUMN     "vatReducedPct" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "vatStandardPct" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "folioId" TEXT,
    "docType" TEXT NOT NULL DEFAULT 'invoice',
    "number" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "issuerVatId" TEXT,
    "issuerAddress" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerVatId" TEXT,
    "buyerAddress" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplyDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "netMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "grossMinor" INTEGER NOT NULL,
    "taxSummary" JSONB NOT NULL,
    "lineSnapshot" JSONB NOT NULL,
    "fiscalRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSeries_propertyId_docType_key" ON "InvoiceSeries"("propertyId", "docType");

-- CreateIndex
CREATE INDEX "TaxInvoice_propertyId_docType_idx" ON "TaxInvoice"("propertyId", "docType");

-- CreateIndex
CREATE INDEX "TaxInvoice_reservationId_idx" ON "TaxInvoice"("reservationId");

-- AddForeignKey
ALTER TABLE "InvoiceSeries" ADD CONSTRAINT "InvoiceSeries_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
