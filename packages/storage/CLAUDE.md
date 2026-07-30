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

⚠️ **The S3 driver has not been exercised against a real bucket yet.** It typechecks and is written
against the AWS SDK; the first deploy with `STORAGE_BUCKET` set must be verified by uploading one
photo and confirming it loads from `STORAGE_PUBLIC_BASE`.

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
prefix.
