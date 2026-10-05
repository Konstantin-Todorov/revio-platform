# Moving Revio to the EU (Railway `europe-west4`, Amsterdam)

> Written 2026-10-05 at the founder's request: *a careful, rehearsed plan before anything is touched.*
> Nothing in production has been changed. Every "now" below was read from Railway or the code today.

## ⚠️ First: the website already says we are in the EU

`revio-websites/src/config/legal.ts` → `SUBPROCESSORS` lists **Railway — "European Union"**. That is
**not true today**: every service, the database volume and the storage bucket are in **`iad`
(Virginia, USA)**. A hotel's DPO, or our own contract annex, will compare the two. Until the move is
done the page must say what is true — or the move must happen soon enough that it becomes true.
**Decision 1 for the founder.**

## Where everything is now (Railway project `revio-platform`, read 2026-10-05)

| What | Region | Notes |
| --- | --- | --- |
| channel-manager · reservation · pms · booking · operator | `iad` | stateless Next.js services |
| jobs (cron `*/10`) · docs · revio-websites | `iad` | stateless |
| **Postgres 18** + volume `postgres-volume` | `iad` | 5 GB volume, **238 MB used, DB 15 MB** (RESTORE.md drill) |
| Storage bucket `optimized-vase` | `iad` | room photos, hero images, logos — **a bucket's region cannot be changed** |
| Nightly + pre-push backups | GitHub Actions artifacts (US) | plain `pg_dump` + bucket mirror |

Third parties that see personal data:

| Who | Where | What changes |
| --- | --- | --- |
| Channex | **EU** (AWS + DigitalOcean EU regions, per their security policy) | nothing |
| Stripe | Ireland / US, SCCs; the **hotel's own** account | nothing — the hotel is Stripe's customer |
| Resend | can **send** from Ireland (`eu-west-1`), but **account data stays in the US** | Decision 3 |
| GitHub | US — holds the code and the backup artifacts | encrypt the backups (step B) |
| GA4 | US — marketing site only, consented visitors, never guest data | nothing |

## The target and why Amsterdam

Railway has one EU region: **EU West Metal, Amsterdam (`europe-west4-drams3a`)**. Same platform, same
plan, same price; ~30 ms from Sofia instead of ~120 ms, so every screen gets slightly faster as a side
effect.

**Everything moves together.** Moving only the database would put an ocean between every app and every
query (≈90 ms × dozens of queries per page). Moving only the apps does the same in reverse.

## How each piece moves

| Piece | Method | Downtime |
| --- | --- | --- |
| 8 stateless services | change the service region | **none** (Railway: "no downtime … except a service with a volume"); domains unchanged |
| Postgres | change the Postgres service region → Railway **migrates the volume** | **yes, while it copies** — 238 MB; the rehearsal measures it |
| Bucket | create an EU bucket, copy every object, repoint the storage variables, keep the old one 30 days | none (re-copy the delta at cut-over) |
| Backups | **encrypt** each dump before upload (`age`, key held by the founder) | none — GitHub then stores only ciphertext |

Why the Railway volume migration and not "new EU database + `pg_dump`/restore": the migration keeps the
same service, internal hostname, `DATABASE_URL` references, the restricted `revio_app` role and every
grant exactly as they are. A restore into a new database has to recreate the role (roles are
cluster-level and not in a dump — RESTORE.md found this) and repoint five services. The restore path
stays as the **rollback**, and RESTORE.md already proves it works in about a minute.

## Step A — the rehearsal (no production change)

1. Create a **temporary** Postgres service in a throwaway Railway environment (`eu-rehearsal`), in `iad`.
2. Restore last night's backup into it; recreate `revio_app` exactly as production has it.
3. Change its region to Amsterdam. **Time the migration** — this is the downtime number for the night.
4. Verify: row counts per table equal the dump's, `rls-verify` 101/101 against it, `state-audit` clean.
5. Delete the environment. Cost: cents.

Plus a bucket copy test: copy every object to a temporary EU bucket, compare counts and checksums.

## Step B — before the night (no downtime)

- Encrypt backups: `backup.sh` pipes through `age -r <founder's public key>`; RESTORE.md gains the
  decrypt step; one restore drill from an encrypted artifact.
- Create the EU bucket; first full copy.
- Tell DesManagement the window a week ahead (one line: "a few minutes of maintenance, Tue 04:00").

## Step C — the night (target window: Tuesday 04:00–04:30 Sofia — after the night audit, before breakfast)

1. Fresh backup (`backup.sh`), confirm it restores.
2. Re-sync the bucket delta; repoint `STORAGE_*` on `reservation` and `booking` to the EU bucket.
3. **Stage** the region change for all nine services in one Railway patch; accept it. Postgres migrates;
   the rest redeploy in Amsterdam behind the same domains.
4. Verify, in order: `/api/health/jobs` all ok · login on all five apps · `rls-verify` · `state-audit` ·
   `route-walk` · a demo booking on RevioDirect lands in CRS and PMS · a Channex push and pull on the demo
   property succeed · a room photo loads.
5. Update the sub-processor list and the contracts' annex to say what is now true.

## Rollback

- During the migration, or if verification fails: change the region back (another volume migration).
- If the volume itself is in doubt: restore the step-C backup into a fresh Postgres in `iad`, recreate
  `revio_app`, repoint — RESTORE.md, ≈1 minute plus repointing. Anything written after that backup is
  lost, which is why the window is at 04:00 and the backup is the step before the switch.
- The old bucket is kept 30 days.

## Decisions for the founder

1. **The website now.** Correct "Railway — European Union" to the truth until the move, or keep it
   and move this week so it becomes true.
2. **The window.** Tuesday 04:00 Sofia proposed; DesManagement told a week ahead.
3. **Email.** Resend can send from Ireland but keeps account data in the US. Keep it (SCCs, already
   disclosed), or move to an EU-resident provider later. Not a blocker for the move.
4. **Backups.** Encrypting them means only the founder's key can restore — keep that key in two places.
