# Deploying Revio to Railway

The platform is a pnpm monorepo on **one Postgres database**. Each app is its own Railway web service
sharing that database.

## Current state (live)

- **Repo:** https://github.com/Konstantin-Todorov/revio-platform (`main`)
- **RevioLink (Channel Manager):** https://channel-manager-production-59bb.up.railway.app
- **Railway project `revio-platform`:** services `channel-manager` (app) + `Postgres` (db).
- **Auto-deploy is ON:** `channel-manager` tracks `main`; every `git push origin main` builds + deploys.
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

## Adding the next app later (Operator / CRS / PMS)

Same project, same database — just another service:

```bash
railway add --service operator
railway variables --service operator --set "DATABASE_URL=${{Postgres.DATABASE_URL}}"
railway up --service operator
```

## Auto-deploy on push (optional, later)

Push the repo to GitHub (`revio-platform`, private) and connect it to each Railway service in the
dashboard. After that every `git push` redeploys automatically.
