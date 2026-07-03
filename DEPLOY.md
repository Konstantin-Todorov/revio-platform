# Deploying Revio to Railway

The platform is a pnpm monorepo on **one Postgres database**. Each app is its own Railway web service
sharing that database.

## Current state (live)

- **Repo:** https://github.com/Konstantin-Todorov/revio-platform (`main`)
- **RevioLink (Channel Manager):** https://channel-manager-production-59bb.up.railway.app
- **Operator Console:** https://operator-production-5eed.up.railway.app
- **Railway project `revio-platform`:** services `channel-manager`, `operator`, `Postgres` (one shared DB).
- **No root `railway.json`** — it applied to every service. Each app service sets its **own** build/start
  via Railway config (`railway environment edit --json` with `build.buildCommand` + `deploy.startCommand`
  using that app's `--filter`). Both target `prisma migrate deploy` → `next start` on `$PORT`.
- **Auto-deploy is ON:** both services track `main`; every `git push origin main` builds + deploys both.
  No manual `railway up` needed. Migrations run on each deploy; the DB is never reset.
- **Seed/inspect the remote DB from local** with Postgres's public URL (internal `DATABASE_URL` isn't
  reachable off-Railway):
  `DATABASE_URL="$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)" pnpm --filter @revio/db db:seed`

The original first-deploy runbook is kept below for reference / new apps.

---

## One-time auth (you, in a terminal on this Mac)

The CLIs need to be authenticated to *your* accounts — a browser login isn't enough.

```bash
railway login          # opens the browser, pairs the CLI with your Railway account
```

That's the only thing blocking the deploy. After it, the agent's commands run as you on this machine.
(Optional, for auto-deploy on push: `brew install gh && gh auth login`, or connect the repo in the
Railway dashboard.)

## Deploy RevioLink (Channel Manager)

```bash
# 1. Project + Postgres + service
railway init --name revio-platform
railway add --database postgres
railway add --service channel-manager

# 2. Point the app at the database (Railway reference variable)
railway variables --service channel-manager --set "DATABASE_URL=${{Postgres.DATABASE_URL}}"

# 3. Deploy from the monorepo root (build/start come from railway.json)
railway up --service channel-manager

# 4. Seed the remote DB ONCE (runs locally against Railway's DATABASE_URL)
railway run --service channel-manager pnpm --filter @revio/db db:seed

# 5. Public URL
railway domain --service channel-manager
```

## How it builds (railway.json)

- **Build:** `pnpm install` → `prisma generate` → `next build` (the whole workspace; Node 22 via `.nvmrc`).
- **Start:** `prisma migrate deploy` (applies any new migrations) → `next start` (binds Railway's `$PORT`).
- Migrations are **versioned** (`packages/db/prisma/migrations/`) and run on every deploy — no drift.
- The seed runs **once** (step 4); production data is never reset by deploys.

## Row-Level Security (tenant isolation) — rollout

RLS is **built and verified locally** (see `BUILD-PLAN.md`). The migration
`20260626130000_enable_rls` adds `ENABLE`+`FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy to
every tenant-owned table, keyed on two transaction-local GUCs the app sets per request:
`app.tenant_id` (hotel perimeter) and `app.bypass='on'` (operator/system + identity/login + seed). The
app sets these via the scoped Prisma clients in `packages/db/src/rls.ts` (`forTenant` / `forSystem`).

**Key fact:** RLS is ignored by Postgres **superusers** and `BYPASSRLS` roles, and `FORCE` only reaches
the table *owner*. So RLS only actually **enforces** when the app connects as a **restricted,
non-superuser role**. Until then the policies exist but are bypassed — deploying the migration alone is
therefore behaviour-neutral (the app keeps working exactly as today via its app-level tenant scoping).

Rollout in two deliberate phases:

**Phase 1 — deploy the machinery (low risk).** `git push` ships the proxy, scoped clients, and the
migration. On deploy, `migrate deploy` adds the policies. The app still connects as the Railway Postgres
role (a superuser), so policies are bypassed → **zero behaviour change**, but the whole path is live.

**Phase 2 — flip enforcement (do with care + rollback ready).** Point the apps at a restricted role:

```bash
# Public URL of the shared DB (owner/superuser connection — for the one-time role setup)
OWNER_URL="$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)"

# 1. Create the restricted app role + grants (run once; password from your secret store)
psql "$OWNER_URL" -v app_password="$REVIO_APP_PASSWORD" -f packages/db/prisma/rls-role.sql

# 2. Split migrate (owner, needs DDL) from runtime (restricted, RLS-enforced) so deploys still migrate:
#    add to datasource in schema.prisma →  directUrl = env("DIRECT_DATABASE_URL")
#    then per app service:
railway variables --service channel-manager --set "DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}"   # owner, for migrate deploy
railway variables --service channel-manager --set "DATABASE_URL=postgresql://revio_app:***@<host>:5432/railway"  # restricted, runtime
#    (repeat for the operator service)

# 3. Redeploy. Verify BOTH apps still load data (not empty) and that tenant A cannot see tenant B.
#    Rollback = set DATABASE_URL back to ${{Postgres.DATABASE_URL}} and redeploy.
```

Verify enforcement the same way it was proven locally (as the restricted role): no GUC → 0 rows;
`set_config('app.tenant_id', '<A>', false)` → only A's rows; `app.bypass='on'` → all rows; an INSERT
with another tenant's `tenantId` is rejected with *"new row violates row-level security policy"*.

**Local dev already does this split:** the apps' `.env` connect as `revio_app` (RLS enforced), while
`packages/db/.env` (owner) is used by `prisma migrate` and `db:seed`. Create the local role once with:
`psql -d revio_dev -v app_password="'revio_app_dev'" -f packages/db/prisma/rls-role.sql`.

## Adding the next app later (Operator / CRS / PMS)

Same project, same database — just another service (this is how `reservation` was added, 2026-07-03):

```bash
railway add --service <name>          # or the Railway MCP create_service
railway variables --service <name> --set "DATABASE_URL=${{Postgres.DATABASE_URL}}"   # reference var
# per-service build/start (NEVER a root railway.json):
railway environment edit \
  --service-config <name> build.buildCommand "corepack enable && pnpm install --no-frozen-lockfile && pnpm --filter @revio/db db:generate && pnpm --filter @revio/<app> build" \
  --service-config <name> deploy.startCommand "pnpm --filter @revio/db db:deploy && pnpm --filter @revio/<app> start"
# set its own AUTH_SECRET, then a domain: railway domain --service <name>
```

**Auto-deploy gotcha:** connecting a `source_repo` at creation builds ONCE but does not track the
branch. Wire the trigger explicitly — and note the config change alone doesn't deploy; kick the
first build yourself:

```bash
railway environment edit \
  --service-config <name> source.repo "Konstantin-Todorov/revio-platform" \
  --service-config <name> source.branch "main"
railway up --service <name> --detach   # first deploy; pushes auto-deploy from then on
```

## Auto-deploy on push (optional, later)

Push the repo to GitHub (`revio-platform`, private) and connect it to each Railway service in the
dashboard. After that every `git push` redeploys automatically.
