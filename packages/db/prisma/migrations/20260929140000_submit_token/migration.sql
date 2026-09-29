-- The server half of "press once": a create form's token, accepted exactly once.
CREATE TABLE "SubmitToken" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT,
  "action"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmitToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubmitToken_createdAt_idx" ON "SubmitToken"("createdAt");

ALTER TABLE "SubmitToken" ADD CONSTRAINT "SubmitToken_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubmitToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubmitToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubmitToken"
  USING (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.bypass', true) = 'on'
         OR "tenantId" = current_setting('app.tenant_id', true));

-- Default privileges should cover this; stated explicitly for the reason in 20260815190000_job_lease.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "SubmitToken" TO revio_app;
  END IF;
END
$$;
