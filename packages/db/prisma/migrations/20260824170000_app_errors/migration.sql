-- Somewhere for an unhandled exception to go.
--
-- Today there is nowhere. The Sync and Error Centers cover OTA failures — a real category, and not
-- this one. An unhandled exception in checkout, in the folio, in the invoice issuer, goes to a
-- container log that rotates and that nobody is watching at 23:00. The detection mechanism for a
-- crash is currently a hotel telephoning to say the screen went white.
--
-- Aggregated by signature, one row per distinct fault. A single bug on a hot route throws thousands
-- of identical exceptions; storing each one fills the database and buries the second, rarer bug that
-- was the one worth reading. `count` carries the volume, which is the only part that differs.
CREATE TABLE "AppError" (
  "id"          TEXT NOT NULL,
  "service"     TEXT NOT NULL,
  "signature"   TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "route"       TEXT,
  "stack"       TEXT,
  "count"       INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"  TIMESTAMP(3),
  "notifiedAt"  TIMESTAMP(3),
  CONSTRAINT "AppError_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppError_service_signature_key" ON "AppError"("service", "signature");
CREATE INDEX "AppError_resolvedAt_lastSeenAt_idx" ON "AppError"("resolvedAt", "lastSeenAt");

-- operator_only: a stack trace can carry a query, an id, a fragment of a guest's data. It is ours to
-- read and never a hotel's, and the table has no tenantId to scope it by even if it were.
ALTER TABLE "AppError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppError" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operator_only ON "AppError";
CREATE POLICY operator_only ON "AppError"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
