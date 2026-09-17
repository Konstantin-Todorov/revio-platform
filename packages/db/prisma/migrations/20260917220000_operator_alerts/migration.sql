-- What we have already told ourselves about, so the hourly alert job can stay silent.
CREATE TABLE "OperatorAlert" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "OperatorAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperatorAlert_key_key" ON "OperatorAlert"("key");
CREATE INDEX "OperatorAlert_resolvedAt_idx" ON "OperatorAlert"("resolvedAt");

-- RLS: operator-only (bypass). This table holds our private assessment of a client's problems and a
-- hotel must never be able to read it. Same pattern as Invoice and ConnectivityCredential.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['OperatorAlert']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS operator_only ON %I', t);
    EXECUTE format($p$CREATE POLICY operator_only ON %I
      USING (current_setting('app.bypass', true) = 'on')
      WITH CHECK (current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
