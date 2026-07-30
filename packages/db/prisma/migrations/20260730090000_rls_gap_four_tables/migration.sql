-- Four tenant-owned tables were never given a tenant_isolation policy.
--
-- Each was added AFTER the sweeping 20260626130000_enable_rls migration, and each one's own
-- migration created the table without the RLS block. App-level scoping has always filtered them
-- correctly, which is exactly why nobody noticed: nothing looks wrong until the database is asked
-- to be the backstop.
--
-- That moment is R3, when production switches to the restricted `revio_app` role on the assumption
-- that every tenant table is covered. These four would have stayed open, silently. TaxInvoice holds
-- issued tax invoices; StayExtra is about to be written by the public booking engine.
--
-- ConnectivityCredential is deliberately NOT here — it has `operator_only`, which is stricter.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['DepositType', 'InvoiceSeries', 'StayExtra', 'TaxInvoice'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')
      WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass', true) = 'on')$p$, t);
  END LOOP;
END $$;
