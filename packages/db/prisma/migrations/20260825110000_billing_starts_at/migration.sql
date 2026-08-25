-- "Free until your first booking syncs" — implemented, not just promised.
--
-- The line is on every product page and in the sales material. The billing code did not implement
-- it: `generateInvoices` billed every active tenant from the month it was created, whether or not
-- the platform had ever done a single thing for them. A promise on a pricing page that the software
-- ignores is discovered by the customer, on their first invoice, and it costs more than the invoice.
--
-- NULL means not yet billable. A property that never takes a booking stays free forever — which is
-- the right answer and not a loophole: no value delivered, no charge.
ALTER TABLE "Tenant" ADD COLUMN "billingStartsAt" TIMESTAMP(3);

-- Demo tenants are billable immediately.
--
-- They are invoiced deliberately, so the whole billing flow stays exercisable end to end (see
-- apps/operator/lib/demo.ts). Gating them behind a real booking sync would silently switch that off
-- and nobody would notice until the first real invoice needed testing.
UPDATE "Tenant" SET "billingStartsAt" = "createdAt" WHERE "isDemo" = true;
