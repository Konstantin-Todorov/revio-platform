-- A payment the hotel asks a guest for after booking, paid on RevioDirect with a link.
CREATE TABLE "PaymentRequest" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "propertyId"       TEXT NOT NULL,
  "reservationId"    TEXT NOT NULL,
  "amountMinor"      INTEGER NOT NULL,
  "currency"         TEXT NOT NULL,
  "note"             TEXT,
  "token"            TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'open',
  "createdByName"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "emailedAt"        TIMESTAMP(3),
  "paidAt"           TIMESTAMP(3),
  "paymentRef"       TEXT,
  "paymentAccountId" TEXT,
  "cardLast4"        TEXT,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_token_key" ON "PaymentRequest"("token");
CREATE INDEX "PaymentRequest_reservationId_idx" ON "PaymentRequest"("reservationId");
CREATE INDEX "PaymentRequest_tenantId_status_idx" ON "PaymentRequest"("tenantId", "status");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentRequest"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PaymentRequest" TO revio_app;
  END IF;
END
$$;
