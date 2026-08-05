# Backup & restore

A backup nobody has restored is not a backup — it is a file you hope about. This document exists
because the drill below was actually run, and because it found things that reasoning would not have.

**Drill run 2026-08-05 against production.** Numbers are from that run, not estimates.

## What is protected today

| Layer | Status | Notes |
| --- | --- | --- |
| Railway **volume backups** (daily/weekly/monthly snapshots) | ❌ **not enabled** | Two clicks: Postgres service → **Backups** tab → pick schedules. Daily keeps 6 days, weekly 1 month, monthly 3 months. |
| Railway **point-in-time recovery** (continuous WAL archiving) | ❌ **not enabled** | Same tab → **Enable PITR**. ~4-week window. **The window starts when you enable it** — switching it on after an incident recovers nothing. |
| **Logical dumps** (`pg_dump`) | ⚠️ manual only | `packages/db/scripts/backup.sh`. The only layer that survives deleting the Railway project itself. |
| **Storage bucket** (room photos, brand assets) | ⚠️ manual only | Covered by the same script. **No database backup contains these bytes.** |

Neither Railway layer can be switched on from the CLI or the API — they are dashboard-only, so they
are the one part of this that has to be done by hand.

## Drill results

Taken with `pg_dump --format=custom` over the public TCP proxy, restored into a throwaway Postgres 18
cluster:

| | |
| --- | --- |
| Database size | 15 MB (volume using 238 MB of 5 GB) |
| Dump | **377 KB, 23 seconds** |
| Restore | **< 1 second**, `--exit-on-error`, zero errors |
| Bucket mirror | 6 objects, 457 KB |
| **Recovery time (RTO)** | **≈ 1 minute** for the data itself, plus role recreation and repointing services |
| **Recovery point (RPO)** | **the age of the newest dump** — with no schedule, that is however long ago someone last ran the script |

Verification of the restored database, against production:

| Check | Result |
| --- | --- |
| Tables | 50 / 50 |
| Row counts | **48 of 50 identical**; `AuditEntry` and `SyncEvent` each 1 row behind |
| Indexes | 129 / 129 identical |
| Constraints | 553 / 553 identical |
| **RLS policies** | **57 / 57 identical**, every `USING` and `WITH CHECK` expression |
| `rls-verify` against the restored DB | **95 / 95 passed** |

The two-row difference is not corruption and not a bug. Both are append-only logs, and the delta is
exactly one scheduled channel-sync tick (5-minute cadence) that landed after the snapshot. It is the
RPO made visible: a point-in-time copy is behind by however long ago you took it. Every business
table — `Reservation`, `Folio`, `FolioLine`, `Guest`, `TaxInvoice`, `Property`, `User` — matched
exactly.

## Three things the drill found that reasoning would not have

### 1. The backup could not be taken at all

Production runs **Postgres 18.4**; the client tools on the development machine were **16.14**.
`pg_dump` refuses to dump a server newer than itself — and *still creates the output file* before it
aborts. A backup script that checked only "did the file appear" would have reported success and
stored **zero bytes**, indefinitely, until the day someone tried to restore it.

`backup.sh` compares server and client major versions and aborts loudly, and separately refuses to
finish on an empty dump. On macOS the fix is `brew install postgresql@18`; do **not** `brew link` it
if local development runs an older Postgres — pass `PG_DUMP=/opt/homebrew/opt/postgresql@18/bin/pg_dump`
instead.

### 2. A restored database refuses every application login

Postgres roles are **cluster-level**. A single-database dump does not contain them. Restoring into a
fresh cluster produces a perfect copy of the data that all five services then fail to connect to:

```
FATAL:  role "revio_app" does not exist
```

This became load-bearing on 2026-08-05, when every service moved off the owner role onto the
restricted `revio_app` (see `DEPLOY.md` → Row-Level Security). Before that, a restore would have
worked by accident. **Recreating the role is now a mandatory restore step**, which is why `backup.sh`
copies `rls-role.sql` into every backup directory — a backup that cannot be restored without a file
from somewhere else is a backup with a footnote.

### 3. Four room photos on production already point at bytes that do not exist

Reconciling `RoomTypePhoto` keys against the bucket found **8 of 14 referenced objects missing** — all
four photos belonging to **Hotel Sofia — Plovdiv**, a property with `bookingEngineEnabled = true`.
Proven on production, side by side:

```
/api/media/…/cmqxe5n63…/…3b8137e9…-thumb.webp   HTTP 200   17262 bytes
/api/media/…/cmrgp5h8u…/…f0d809c9…-thumb.webp   HTTP 404       9 bytes
```

Both properties' photos were uploaded on 2026-07-30. One survived and one did not, which is what you
would expect if Plovdiv's went to the **local-disk driver** before `STORAGE_BUCKET` was configured:
that directory lives in a container filesystem and is gone at the next deploy. No guest sees the
breakage *today* only because Plovdiv currently has no availability, so no room card renders — that
is luck, not a safeguard.

There are **zero orphans in the other direction**: every object in the bucket is referenced by a row.

## Taking a backup

```bash
./packages/db/scripts/backup.sh            # writes ./backups/<timestamp>/
```

Produces `database.dump`, `bucket/`, `rls-role.sql`, and a `MANIFEST.txt` recording the server
version, size, latest applied migration and object count. **Both halves are taken together** — a
database restored without its bucket gives a hotel whose rooms have no photographs and whose booking
page has no logo: every row correct, every image broken.

## Restoring

1. **Provision Postgres of the same major version.** A dump does not restore into an older server.
2. **Recreate the role** — before anything tries to connect:
   ```bash
   psql "$OWNER_URL" -v app_password="$REVIO_APP_PASSWORD" -f rls-role.sql
   ```
3. **Restore the data.** `--exit-on-error` so a partial restore fails instead of quietly half-working:
   ```bash
   pg_restore --dbname="$OWNER_URL" --no-owner --exit-on-error database.dump
   ```
4. **Restore the bucket** — upload `bucket/` back under the same keys. The keys are absolute paths
   stored in the database; they must land unchanged or every image 404s.
5. **Verify isolation before serving traffic**, as the restricted role:
   ```bash
   DATABASE_URL="postgresql://revio_app:…@…/railway" pnpm --filter @revio/db rls-verify
   ```
   This is not optional. RLS policies travel with the dump, but the **role and its GRANTs do not** —
   and a database that answers queries while failing to isolate tenants is worse than one that is
   down, because nothing looks wrong.
6. **Repoint the services**: `DATABASE_URL` (restricted) and `DIRECT_DATABASE_URL` (owner) per service.

Then compare row counts against whatever you still have, and expect append-only tables to be behind.

## Do this next

1. **Enable PITR and daily volume backups in the Railway dashboard.** The single highest-value action
   here, and it cannot be scripted. PITR's window only covers time *after* you switch it on.
2. **Schedule `backup.sh`** — a Railway cron service uploading to a separate bucket gives an offsite
   copy that survives losing the project. Until then the RPO is "whenever someone last remembered".
3. **Decide what to do about Plovdiv's four photos**: re-upload them, or delete the rows so the
   database stops promising an image it cannot produce.
