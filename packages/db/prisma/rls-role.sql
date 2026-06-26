-- One-time, per-environment provisioning of the restricted application DB role.
--
-- RLS only actually enforces when the app connects as a NON-superuser, NON-owner role: superusers and
-- BYPASSRLS roles ignore policies, and FORCE RLS only reaches the table owner. So the apps must connect
-- as `revio_app` (created here), while migrations/seed keep using the owner/superuser connection.
--
-- Run ONCE as the database owner/superuser, then point the apps' DATABASE_URL at revio_app. Migrations
-- (prisma migrate deploy) and the seed keep using the owner URL (set it as DIRECT_DATABASE_URL / the
-- Railway Postgres default). Re-runnable: role creation is guarded; GRANTs are idempotent.
--
-- Set the password out of band before running (psql variable), e.g.:
--   psql "$OWNER_DATABASE_URL" -v app_password="$REVIO_APP_PASSWORD" -f rls-role.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revio_app') THEN
    CREATE ROLE revio_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Set/rotate the login password (psql substitutes :'app_password').
ALTER ROLE revio_app WITH LOGIN PASSWORD :'app_password';

-- Privileges: DML only, no DDL, no ownership. RLS policies then constrain which rows it may touch.
GRANT USAGE ON SCHEMA public TO revio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO revio_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO revio_app;

-- Cover tables/sequences created by future migrations too (run as the same owner that owns them).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO revio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO revio_app;

-- The app role must NOT read Prisma's migration bookkeeping.
REVOKE ALL ON TABLE "_prisma_migrations" FROM revio_app;
