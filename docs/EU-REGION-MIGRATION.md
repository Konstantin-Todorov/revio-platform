# Moving Revio to the EU (Railway `europe-west4`, Amsterdam)

> ## ✅ DONE — 6 October 2026, 04:26–04:41 UTC (07:26–07:41 Sofia)
>
> Writes frozen at 04:26:36 (old database set read-only, 15 sessions ended). Copied 43 s + 35 s;
> 82/82 tables identical; `rls-verify` 139/139 on the new database before any app touched it. The five
> apps repointed to `postgres-eu.railway.internal` (host only — same passwords), `reservation` and
> `booking` to the new bucket `revio-photos-eu` (16/16 objects verified), all eight services moved to
> `europe-west4-drams3a`. Apps up on the new database ≈04:31–04:33 — **writes frozen ≈5–6 minutes,
> reads never down.** Verified after: 6 connections on the new database and none on the old; 16/16
> jobs ok and writing their leases; Channex pulls succeeding from Amsterdam (a non-200 throws, so
> "success" means 200); room photos served from the new bucket; `state-audit` identical to before.
> Backups repointed (`Postgres-EU`, GitHub secrets). Website updated to say EU, with GitHub added
> for the encrypted backup.
>
> **Kept 30 days, read-only, then deleted:** the old `Postgres` service in `iad` (default_transaction_
> read_only = on) and the old bucket `optimized-vase`. Rollback until then: point the five
> `DATABASE_URL`/`DIRECT_DATABASE_URL` back at `postgres.railway.internal` and turn read-only off.

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

## ✅ Rehearsal results (2026-10-05, throwaway project `revio-eu-rehearsal`, now emptied)

Run against a copy of production restored from the 20:13 UTC pre-push backup (82 tables, 73,769 rows,
39 MB). What it **proved**, and what it **changed in this plan**:

| Finding | Number | Consequence |
| --- | --- | --- |
| **Changing a database's region does NOT move its data.** The service config flipped to Amsterdam; the volume stayed in `iad`. Railway's own agent: volume migration is not exposed in the API or the dashboard — only Railway support can do it. | — | **The in-place method is dropped.** Done on production it would have left a database in Amsterdam reading its disk in Virginia. |
| A **new** Postgres with its volume created directly in `europe-west4` works over the API | Postgres 18.6, same image | This is the method now. Template deploys need 2FA in the dashboard; `create-service` + `create-volume(region)` does not. |
| Copy Virginia → Amsterdam (dump + parallel restore + role) | **127 s** (47 + 78 + 2) from a laptop in Sofia | The data part of the downtime. Faster from inside Railway. |
| Row counts after the copy | **82/82 tables identical** | — |
| `rls-verify` against the EU copy, as `revio_app` | **139/139** | Tenant isolation survives the move intact. |
| `state-audit` against the EU copy | same result as production | — |
| Round trip from Sofia (via proxy) | **267 ms → 149 ms** | ~45% faster per query |
| ⚠️ Restoring a backup **over the network** to Virginia | **258 s** | RESTORE.md's "≈1 minute" was a local restore. Rollback timings below use the real number. |

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
| Postgres | **new** Postgres in Amsterdam (volume created there), copy the data, recreate `revio_app`, repoint `DATABASE_URL` | **yes — ≈5–7 min** (copy 127 s + repoint and redeploy); measured in the rehearsal |
| Bucket | create an EU bucket, copy every object, repoint the storage variables, keep the old one 30 days | none (re-copy the delta at cut-over) |
| Backups | **encrypt** each dump before upload (`age`, key held by the founder) | none — GitHub then stores only ciphertext |

Why a new database and not Railway's volume migration: the rehearsal showed the volume does not move
(see above). The new-database path costs two extra steps — recreate `revio_app` (in every backup as
`rls-role.sql`) and repoint the services' `DATABASE_URL` — and buys the best rollback there is: **the
old database is never touched**, so going back is repointing the variables, not restoring anything.

**Freezing writes during the copy.** Anything written after the dump starts would be lost. So at the
start of the window `revio_app` loses INSERT/UPDATE/DELETE on the old database: the apps keep reading,
writes fail cleanly for a few minutes, nothing half-written. Bookings from Booking.com and the other
channels are not lost — Channex holds them until we pull, and the first pull after the switch fetches
them. The `jobs` cron is paused for the window.

## Step A — the rehearsal ✅ done 2026-10-05 (results above)

Also done the same night:

- **Bucket copy** — `packages/db/scripts/bucket-copy.mjs` into a temporary Amsterdam bucket:
  16/16 objects identical by SHA-256 and content type; a second run copied nothing (the delta pass
  for the night works). Temporary bucket deleted.
- **Channex and our IP address** — moving changes the address we call Channex from. Checked: their
  API key is not IP-bound (the production key answers HTTP 200 with data from a laptop in Bulgaria),
  their docs mention IP allowlisting only for webhooks *we* receive, and our webhook handler does not
  filter by IP. Webhooks target our domains, which do not change. Stripe and Resend are the same:
  keys and domains, no IP binding.

## Step B — before the night (no downtime)

- ✅ Backups encrypted (2026-10-05): GitHub now receives only `backup.tar.age` + `MANIFEST.txt`;
  a CI run was downloaded and decrypted to 82 tables. RESTORE.md → *Encrypted backups*.
- Create the EU bucket; first full copy.
- Tell DesManagement the window a week ahead (one line: "a few minutes of maintenance, Tue 04:00").

## Step C — the night (target window: Tuesday 04:00–04:30 Sofia — after the night audit, before breakfast)

1. Fresh backup (`backup.sh`), confirm it restores.
2. Create the EU Postgres (volume in `europe-west4`) and recreate `revio_app` — before the window.
3. **Freeze:** revoke writes from `revio_app` on the old database; pause the `jobs` cron.
4. Copy: `pg_dump` old → `pg_restore -j 4` new; compare row counts table by table; `rls-verify`.
5. Repoint `DATABASE_URL` / `DIRECT_DATABASE_URL` on the five apps and `jobs` to the new database;
   re-sync the bucket delta and repoint `STORAGE_*` on `reservation` and `booking`.
6. Move the eight stateless services' region to Amsterdam (no downtime); unpause `jobs`.
4. Verify, in order: `/api/health/jobs` all ok · login on all five apps · `rls-verify` · `state-audit` ·
   `route-walk` · a demo booking on RevioDirect lands in CRS and PMS · a Channex push and pull on the demo
   property succeed · a room photo loads.
5. Update the sub-processor list and the contracts' annex to say what is now true.

## Rollback

- **Before the repoint:** nothing has changed — give `revio_app` its writes back on the old database.
- **After the repoint, if verification fails:** point `DATABASE_URL` back at the old database and give
  writes back. Minutes, no restore. Anything written to the new database in between is the only loss,
  and at 04:00 that is close to nothing.
- The old database and the old bucket are kept **30 days**, read-only, then deleted.

## Decisions for the founder

1. ~~**The website now.**~~ ✅ Corrected 2026-10-05: it now says United States (Virginia), under the
   SCCs, EU move in preparation. Change it back the night of the move.
2. **The window.** Tuesday 04:00 Sofia proposed; DesManagement told a week ahead.
3. **Email.** Resend can send from Ireland but keeps account data in the US. Keep it (SCCs, already
   disclosed), or move to an EU-resident provider later. Not a blocker for the move.
4. **Backups.** Encrypting them means only the founder's key can restore — keep that key in two places.
