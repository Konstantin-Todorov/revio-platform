# Package: Storage (`@revio/storage`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Rationale:
> `docs/specs/BOOKING-ENGINE-DESIGN.md` §2.6. Deploy config: `DEPLOY.md` → Object storage.

Object storage for user-uploaded media. RevioCRS writes room photos; RevioDirect reads them — two
apps, so it is a package.

## Why bytes are not in Postgres

Six room types × eight photos ≈ 50 MB per property; a hundred properties is 5 GB **inside the row
store**. That bloats every backup and restore, costs an order of magnitude more per GB, and routes
every image request through the Next server instead of a CDN edge. Only keys live in `RoomTypePhoto`.

The email logo *is* in Postgres and that is fine — one ~20 KB file per property. **The difference is
volume, not principle.** Don't cite the logo as precedent for the next upload feature without doing
that arithmetic.

## Two drivers, chosen by environment

| | |
| --- | --- |
| **local** | Writes under `.storage/`, served by a Next route. With no configuration at all, the photo feature works — a laptop needs no bucket. |
| **s3** | Any S3-compatible bucket. **Selected by the presence of `STORAGE_BUCKET`**, never by a caller, so no screen can hardcode one and behave differently in production than it did in review. |

A relative storage dir resolves against the **workspace root**, not `process.cwd()`. Otherwise
RevioCRS writes to `apps/reservation/.storage` and RevioDirect 404s reading `apps/booking/.storage` —
found by a test, not in production.

`forcePathStyle` is on whenever `STORAGE_ENDPOINT` is set: Railway and MinIO address buckets by path,
AWS by subdomain, and that mismatch is the usual reason a correct-looking S3 client 404s.

✅ **The S3 driver is live and exercised.** Verified 2026-08-05 against the production bucket: objects
list, download and serve (`/api/media/…` → HTTP 200).

⚠️ **Rows can outlive their bytes, and nothing currently notices.** The keys in `RoomTypePhoto` and
`BrandAsset` are a reference to a different system, so the database cannot enforce that the object
exists — there is no foreign key across that boundary. The R4 drill found **4 of 7 production room
photos pointing at objects that are gone** (`docs/RESTORE.md` §3): they were uploaded while the
**local-disk driver** was active, into a container filesystem that a deploy replaced. The database
kept promising an image nobody can produce.

Two consequences worth carrying:

- **Switching a property to the bucket does not migrate what it already had.** Photos uploaded before
  `STORAGE_BUCKET` was set need re-uploading; the rows will not tell you which.
- **Back the bucket up with the database, not separately.** `packages/db/scripts/backup.sh` takes both
  in one run for exactly this reason — restoring one without the other yields rows that are
  individually correct and collectively useless.

## Keys are derived, never accepted

A filename from a browser is attacker-controlled: `../` escapes the prefix, a leading `/` changes the
root, and a colliding name silently overwrites another hotel's photo. So `keys.ts` builds the path
from ids we already trust plus a random token, and picks the extension from the format **we** encoded
— not from what the upload claimed to be.

`.` and `..` are rejected as whole **segments**, not as substrings: a dot is legal inside a filename
(`abc123-full.webp`), so a substring check would wrongly accept `t/./p`. That distinction was a real
bug, caught by `storage.test.ts`.

Layout is `t/<tenant>/p/<property>/rooms/<roomType>/<token>-<variant>.webp` — tenant first, so a
bucket listing groups the way a support question is asked and a per-tenant lifecycle rule is one
prefix. The booking page's hero photograph sits at `t/<tenant>/p/<property>/hero/<token>-<variant>.webp`
— **beside `rooms/`, deliberately not inside it**, because it belongs to the hotel rather than to
anything sellable, and a future delete-by-prefix sweep of a room type's photos must not be able to
take the hotel's front door with it. It still carries a random token even though a property has at
most one: replacing bytes under a stable key leaves every CDN and browser serving the old image.
