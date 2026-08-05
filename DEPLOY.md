# Deploying Revio to Railway

The platform is a pnpm monorepo on **one Postgres database**. Each app is its own Railway web service
sharing that database.

## Current state (live)

- **Repo:** https://github.com/Konstantin-Todorov/revio-platform (`main`)
- **RevioLink (Channel Manager):** https://channel-manager-production-59bb.up.railway.app
- **Operator Console:** https://operator-production-5eed.up.railway.app
- **RevioCRS (Reservation):** https://reservation-production-f8c5.up.railway.app
- **RevioPMS (Operations):** https://pms-production-a64b.up.railway.app
- **RevioDirect (booking engine):** https://booking-production-8e50.up.railway.app/&lt;slug&gt; — live,
  e.g. `/hotel-sofia`. The object-storage bucket it needed is provisioned and shared with
  `reservation`, so room photos survive a deploy. **Still on the Railway subdomain**, and that is the
  one thing left: this is the only app a *guest* visits, so it should not sit on a `*.up.railway.app`
  URL a hotel would be embarrassed to print. Pointing `book.revio.app` at it is a DNS change plus one
  variable — `BOOKING_ENGINE_ORIGIN` on the `reservation` service, which is where the CRS builds the
  link it shows the hotel. Nothing else refers to the host.
- **Railway project `revio-platform`:** services `channel-manager`, `operator`, `reservation`, `pms`,
  `booking`, `Postgres` (one shared DB).
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

**Phase 2 — flip enforcement (do with care + rollback ready).** Point the apps at a restricted role.

> **⚠ Sequencing trap, found the hard way 2026-07-26.** Prisma 5's `directUrl` is **required once
> declared** — it does *not* fall back to `DATABASE_URL` when the env var is missing. Adding it to
> `schema.prisma` and pushing would fail `prisma migrate deploy` on **every** service at once, since
> migrate runs on each Railway deploy. So the order below is not optional:
>
> 1. Set `DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}` on **all five** app services first
>    (a Railway reference, not a literal — no secret is copied anywhere). Skip deploys.
> 2. *Then* add `directUrl = env("DIRECT_DATABASE_URL")` to the datasource and push.
>    At this point nothing has changed behaviourally: migrate and runtime both use the owner.
> 3. *Then* create the restricted role and swap `DATABASE_URL` per service, one service at a time,
>    verifying each before moving to the next.
>
> Steps 1 and 2 were done 2026-08-05: `DIRECT_DATABASE_URL` is set on **all five** app services as a
> Railway reference, and the datasource declares `directUrl`.

### The gate: `pnpm --filter @revio/db rls-verify`

Don't reason about whether isolation holds — run it. The script connects, asks Postgres what role it
is, and **refuses to run** as a superuser or a `BYPASSRLS` role, because under those roles every
assertion passes without proving anything. That refusal is the point: it is the exact mistake that
makes a green RLS check meaningless.

It then walks `Prisma.dmmf` rather than a hand-written table list — a table added by a future
migration is covered the day it appears, instead of the day someone remembers to update this file —
and for every tenant-owned model checks that an unscoped client sees nothing, that tenant A sees only
A's rows (compared against the true count read under bypass, so an *empty* table cannot masquerade as
an *isolated* one), and that operator-only tables are invisible to a hotel. Then it tries to write a
row into another tenant's account, and finally asserts directly that no table in the database has RLS
switched off.

```bash
DATABASE_URL="postgresql://revio_app:<password>@<host>:<port>/railway" pnpm --filter @revio/db rls-verify
```

**Run it against a database before pointing an app at it, and again after.** Local run 2026-08-05:
95/95, including `new row violates row-level security policy for table "AuditEntry"` and *every table
in the database has RLS enabled — none missing*.

```bash
# Public URL of the shared DB (owner/superuser connection — for the one-time role setup)
OWNER_URL="$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)"

# 1. Create the restricted app role + grants (run once; generate the password, never commit it)
psql "$OWNER_URL" -v app_password="$REVIO_APP_PASSWORD" -f packages/db/prisma/rls-role.sql

# 2. Prove the role before any app depends on it.
DATABASE_URL="postgresql://revio_app:$REVIO_APP_PASSWORD@<host>:<port>/railway" \
  pnpm --filter @revio/db rls-verify

# 3. Swap runtime credentials ONE SERVICE AT A TIME, verifying each before the next.
#    DIRECT_DATABASE_URL (owner) stays put — migrate deploy still needs DDL rights.
railway variables --service booking --set "DATABASE_URL=postgresql://revio_app:***@<host>:<port>/railway"
#    then channel-manager · operator · reservation · pms

# Rollback, per service, no code change: set DATABASE_URL back to a reference to the owner and redeploy.
railway variables --service booking --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
```

Order matters: swap **booking first**. It is the smallest surface, and it is the only app whose
breakage a hotel's staff would not notice — a guest-facing 500 is bad, but it is one page, and the
public site is the one place where "sees nothing" is visually obvious immediately. Leave `pms` for
last: it has the most write paths (folios, housekeeping, the night audit), so it is the one you want
to swap with four known-good services behind you.

**Local dev does the same split:** each app's `.env` connects as `revio_app` (RLS enforced), while
`packages/db/.env` (owner) is used by `prisma migrate` and `db:seed`. Create the local role once with:
`psql -d revio_dev -v app_password="'revio_app_dev'" -f packages/db/prisma/rls-role.sql`.

Until 2026-08-05 only `channel-manager` and `operator` had that `.env`, so **RevioCRS, RevioPMS and
RevioDirect had never once run under an enforcing role** — the three newest and largest apps, and the
only one that is public. They do now, which is what made this flip a verification rather than a bet.

## Adding the next app later (Operator / CRS / PMS)

Same project, same database — just another service (`reservation` added 2026-07-03; `pms` 2026-07-04):

```bash
railway add --service <name>                       # CLI is interactive; the service still gets created
railway variables --service <name> \
  --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' \  # single-quote so the shell doesn't expand the ref
  --set "AUTH_SECRET=$(openssl rand -hex 32)"        # each service gets its own secret
railway domain --service <name>                    # generates <name>-production-XXXX.up.railway.app
```

**Per-service build/start — the CLI can't set it (v4.61.1 has NO `railway environment edit
--service-config`; that runbook was for the Railway MCP, whose token expires mid-session).** Set the
build/start commands and connect the GitHub source via the **GraphQL API** with the CLI's own
`accessToken` (from `~/.railway/config.json` → `user.accessToken`). **Cloudflare 403s (error 1010)
the default urllib UA — send a browser `User-Agent`.** Endpoint `https://backboard.railway.com/graphql/v2`:

```
# 1) connect source (repo + branch → enables push auto-deploy):
mutation{ serviceConnect(id:"<serviceId>", input:{repo:"Konstantin-Todorov/revio-platform", branch:"main"}){id} }
# 2) set build + start on the production ServiceInstance (returns true):
mutation{ serviceInstanceUpdate(serviceId:"<serviceId>", environmentId:"<prodEnvId>", input:{
  buildCommand:"corepack enable && pnpm install --no-frozen-lockfile && pnpm --filter @revio/db db:generate && pnpm --filter @revio/<app> build",
  startCommand:"pnpm --filter @revio/db db:deploy && pnpm --filter @revio/<app> start" }) }
```
(prod env id `3da5ed39-384c-4c26-8e1a-e7032c1b4dfe`. If `serviceInstanceUpdate` 400s ("Problem
processing request") right after `serviceConnect`, it's a race — just retry it.) Then
`railway up --service <name> --detach` for the first build (or setting a var already triggers one from
the connected source). **NB deploy does NOT re-seed** — new entitlement flags (e.g. `hasPms`) +
backfill data must be applied to prod separately via `DATABASE_PUBLIC_URL`
(`railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL`); the PMS units backfill is
kept as an idempotent, re-runnable example at `packages/db/scripts/pms-prod-backfill.sql`.

## Auto-deploy on push (optional, later)

Push the repo to GitHub (`revio-platform`, private) and connect it to each Railway service in the
dashboard. After that every `git push` redeploys automatically.

## Object storage (room photos)

Room photographs are **not** in Postgres — only their object keys are (`RoomTypePhoto`). A hundred
properties at ~50 MB of photos each would put 5 GB inside the row store, which bloats every backup
and restore, costs an order of magnitude more per GB than object storage, and routes every image
request through the Next server instead of a CDN edge. (The email *logo* is in Postgres and that is
correct — one ~20 KB file per property. The difference is volume, not principle.)

**With no configuration at all, the local-disk driver is used** and everything works: uploads,
gallery, the public page. That is what runs on a laptop, writing to `.storage/` at the repo root
(gitignored). Nothing about the photo feature is blocked on provisioning a bucket.

**To switch to a Railway bucket**, create it and set these on **both** `reservation` (writes) and
`booking` (reads):

```bash
railway add --database # or: create an object storage bucket in the Railway dashboard
```

| Variable | What it is |
| --- | --- |
| `STORAGE_BUCKET` | Bucket name. **Presence of this variable is what selects the S3 driver.** |
| `STORAGE_ENDPOINT` | Bucket endpoint. Required for Railway/MinIO — anything that is not AWS. |
| `STORAGE_REGION` | Defaults to `us-east-1`; most S3-compatible stores ignore it. |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Credentials. |
| `STORAGE_PUBLIC_BASE` | Public origin (bucket URL or CDN). **Set this** — without it images fall back to being served through our own server, which gives up the whole point of a bucket. |

`forcePathStyle` is on whenever `STORAGE_ENDPOINT` is set, because Railway and MinIO address buckets
as `endpoint/bucket/key` rather than as a `bucket.` subdomain. Leaving that off is the most common
reason an otherwise-correct S3 client 404s against a non-AWS endpoint.

⚠️ **The S3 driver has not been exercised against a real bucket yet** — none exists on the account.
It is written against the AWS SDK and typechecks, but the first deploy with `STORAGE_BUCKET` set
should be verified by uploading one photo and confirming it loads from `STORAGE_PUBLIC_BASE`.
Existing photos do not migrate themselves: the keys stay valid, but the bytes have to be copied from
`.storage/` into the bucket with the same key layout (`t/<tenant>/p/<property>/rooms/<roomType>/…`).
