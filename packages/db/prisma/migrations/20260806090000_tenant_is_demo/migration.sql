-- Demo tenants live in production, permanently, beside the real ones.
--
-- The alternative is a staging copy of a five-app platform sharing one database, one Channex account
-- and one storage bucket. That is a second environment to keep in sync, and it always drifts — which
-- means the thing you tested on stops resembling the thing customers use, exactly when it matters.
-- Keeping the demo hotels in production means every test runs against the real deployment, the real
-- migrations and the real RLS.
--
-- The cost of that choice is that two fake hotels sit inside every number the operator console
-- reports: MRR, billed revenue, client counts, the attention feed, revenue by product. A console
-- built to stop us counting things that do not matter cannot itself count revenue that does not
-- exist. So the flag draws one line, stated once in apps/operator/lib/demo.ts:
--
--   MONEY AND PORTFOLIO METRICS EXCLUDE DEMO.  OPERATIONS AND HEALTH INCLUDE IT.
--
-- A demo tenant behaves identically in RevioLink, RevioCRS, RevioPMS and RevioDirect — it must, or
-- testing on it proves nothing. Invoices are still generated for it too, so the billing flow stays
-- testable; they simply never count toward MRR.

ALTER TABLE "Tenant" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- The two hotels that have only ever been ours. Matched by slug so this is a no-op on any database
-- that does not have them (a fresh customer install, a restored dump under a different name).
UPDATE "Tenant" SET "isDemo" = true WHERE slug IN ('hotel-sofia', 'black-sea-resort');
