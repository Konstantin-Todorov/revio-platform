-- Every email the support mailbox handed us, and what we did with it.
--
-- The dedupe key AND the audit trail. The mailbox is READ ONLY to us — nothing is marked seen,
-- moved or deleted, so a human's inbox stays exactly as they keep it — which means the only way the
-- next run knows it has already handled a message is a row here.

CREATE TABLE "InboundEmail" (
  "id"         TEXT NOT NULL,
  "messageId"  TEXT NOT NULL,
  "fromEmail"  TEXT NOT NULL,
  "subject"    TEXT NOT NULL,
  "outcome"    TEXT NOT NULL,
  "requestId"  TEXT,
  "detail"     TEXT,
  "receivedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- What makes re-reading the mailbox harmless.
CREATE UNIQUE INDEX "InboundEmail_messageId_key" ON "InboundEmail"("messageId");
CREATE INDEX "InboundEmail_createdAt_idx" ON "InboundEmail"("createdAt");
CREATE INDEX "InboundEmail_outcome_idx" ON "InboundEmail"("outcome");

-- Operator-perimeter. This is OUR mailbox: it holds mail from every customer, so a hotel-scoped
-- session must see none of it. No tenant clause — only the bypass perimeter can read or write.
ALTER TABLE "InboundEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundEmail" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "InboundEmail"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
