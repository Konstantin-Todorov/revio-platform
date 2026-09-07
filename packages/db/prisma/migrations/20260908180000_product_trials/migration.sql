-- A hotel trying a product before buying it.
--
-- ⚠️ A TRIAL NEVER BECOMES A CHARGE ON ITS OWN. It expires and access stops; converting is a
-- separate, deliberate act by an operator. A customer who discovers a subscription they did not
-- agree to will not stay one, and "we warned you by email" is not consent. There is deliberately no
-- column here that could turn into billing by itself.
--
-- A ROW PER TRIAL, not a date on the tenant. The history is the point: "they tried RevioPMS in March
-- and did not keep it" is exactly what a renewal call needs, and a nullable date column would have
-- been overwritten by the next trial and the fact lost.
--
-- Ending a trial takes nothing away except access. Rooms, rates, reservations and guests are shared
-- with the products they already pay for, so nothing is deleted and switching it back on restores
-- everything instantly.

CREATE TABLE "ProductTrial" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  -- cm | crs | pms
  "product"     TEXT NOT NULL,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"      TIMESTAMP(3) NOT NULL,
  -- Null means running, and only a running trial is swept.
  "endedAt"     TIMESTAMP(3),
  -- converted | cancelled | expired. Only 'expired' is ever written by a machine.
  "outcome"     TEXT,
  -- Which operator granted it. Nobody self-serves a trial.
  "grantedById" TEXT,
  -- Which warnings have gone out, so none is sent twice however often the sweep runs.
  "remindedAt7" TIMESTAMP(3),
  "remindedAt1" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductTrial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductTrial_tenantId_product_idx" ON "ProductTrial"("tenantId", "product");
-- The sweep: everything still running, soonest to end first.
CREATE INDEX "ProductTrial_endedAt_endsAt_idx" ON "ProductTrial"("endedAt", "endsAt");

-- One RUNNING trial per product per tenant. A partial unique index says it in the database rather
-- than trusting the app to check first — two overlapping trials would double the reminders and race
-- to revoke the same entitlement.
CREATE UNIQUE INDEX "ProductTrial_one_running_per_product"
  ON "ProductTrial"("tenantId", "product") WHERE "endedAt" IS NULL;

ALTER TABLE "ProductTrial" ADD CONSTRAINT "ProductTrial_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Operator-perimeter, like Invoice and the CRM tables: a trial is our commercial arrangement with a
-- hotel, and a hotel has no business reading the row that decides when their access stops.
ALTER TABLE "ProductTrial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductTrial" FORCE ROW LEVEL SECURITY;
CREATE POLICY operator_only ON "ProductTrial"
  USING (current_setting('app.bypass', true) = 'on')
  WITH CHECK (current_setting('app.bypass', true) = 'on');
