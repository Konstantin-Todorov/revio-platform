#!/usr/bin/env bash
#
# One full offsite backup: the database AND the bucket.
#
# Both halves or neither. `RoomTypePhoto` and `BrandAsset` store object KEYS; the bytes live in the
# storage bucket. Restoring only the database gives you a hotel whose rooms have no photographs and
# whose booking page has no logo — rows that are individually correct and collectively useless. The
# two must be captured together, close in time, or the keys and the objects disagree.
#
#   ./packages/db/scripts/backup.sh [output-dir]      # defaults to ./backups
#
# Requires: the Railway CLI logged in and linked, and pg_dump matching the SERVER's major version.
# The version check below is not paranoia — pg_dump refuses to dump a newer server, and when it does
# it still leaves a zero-byte file behind, so a script that trusts the file's existence "succeeds"
# forever while storing nothing. That is how backups turn out to be empty on the day you need them.
set -euo pipefail

OUT="${1:-backups}"
# Why this backup was taken — "pre-push · 2 new migrations", "manual", "pre-demo". Recorded in the
# manifest and in the directory name, because when you are choosing which backup to restore at 2am,
# "the one taken right before the migration that broke it" is the only label that helps.
REASON="${BACKUP_REASON:-manual}"
# Keep this many. Each backup is under a megabyte (386 KB database + 457 KB bucket at the time of
# writing), so retention is generous on purpose — pruning aggressively to save kilobytes would be
# trading the thing that has value for the thing that costs nothing.
KEEP="${BACKUP_KEEP:-20}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT/$STAMP"
mkdir -p "$DEST"

# The URL comes from the environment when it is there, and from the Railway CLI when it is not.
#
# Env first so this runs somewhere with no CLI and nobody logged in — which is the whole point of the
# scheduled job in `.github/workflows/backup.yml`. The pre-push hook on a developer's machine keeps
# working exactly as before, because nothing sets the variable there.
if [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
  echo "→ using DATABASE_PUBLIC_URL from the environment"
  PROD_URL="$DATABASE_PUBLIC_URL"
else
  echo "→ resolving connection details from Railway"
  PROD_URL="$(railway variables --service Postgres --json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).DATABASE_PUBLIC_URL')"
fi

SERVER_MAJOR="$(psql "$PROD_URL" -tAc 'SHOW server_version;' | cut -d. -f1)"
DUMP_BIN="${PG_DUMP:-pg_dump}"
CLIENT_MAJOR="$("$DUMP_BIN" --version | grep -oE '[0-9]+' | head -1)"
if [ "$SERVER_MAJOR" != "$CLIENT_MAJOR" ]; then
  echo "ABORT: server is Postgres $SERVER_MAJOR but $DUMP_BIN is $CLIENT_MAJOR." >&2
  echo "       pg_dump cannot dump a newer server. Install matching client tools and either put" >&2
  echo "       them first on PATH or set PG_DUMP=/path/to/pg_dump (macOS: brew install postgresql@$SERVER_MAJOR;" >&2
  echo "       the binaries are under /opt/homebrew/opt/postgresql@$SERVER_MAJOR/bin)." >&2
  exit 1
fi

echo "→ dumping the database (server $SERVER_MAJOR, client $CLIENT_MAJOR)"
"$DUMP_BIN" "$PROD_URL" --format=custom --no-owner --no-privileges --file="$DEST/database.dump"
# Fail loudly on an empty dump. `set -e` catches a non-zero exit, but not a silent truncation.
[ -s "$DEST/database.dump" ] || { echo "ABORT: dump file is empty." >&2; exit 1; }

echo "→ mirroring the storage bucket"
node "$(dirname "$0")/backup-bucket.mjs" "$DEST/bucket"

# Roles are CLUSTER-level and are NOT in a single-database dump. Since every app now connects as the
# restricted revio_app role, a restore without it leaves all five services unable to log in at all.
# rls-role.sql recreates it; copy it alongside the data so the backup is self-contained.
cp "$(dirname "$0")/../prisma/rls-role.sql" "$DEST/rls-role.sql"

{
  echo "taken:            $STAMP"
  echo "reason:           $REASON"
  echo "server version:   $(psql "$PROD_URL" -tAc 'SHOW server_version;')"
  echo "database size:    $(psql "$PROD_URL" -tAc 'SELECT pg_size_pretty(pg_database_size(current_database()));')"
  echo "latest migration: $(psql "$PROD_URL" -tAc 'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1;')"
  echo "dump bytes:       $(wc -c < "$DEST/database.dump" | tr -d ' ')"
  echo "bucket objects:   $(find "$DEST/bucket" -type f 2>/dev/null | wc -l | tr -d ' ')"
} > "$DEST/MANIFEST.txt"

# Prune oldest, keeping $KEEP. Done AFTER the new backup is complete and verified non-empty, so a
# failed run can never delete a good backup to make room for nothing.
# `head -n -N` is a GNU extension and this runs on macOS, where it fails outright — which the pre-push
# hook then reports as a failed backup and blocks the push. Count and take from the front instead;
# it is portable, and the timestamped names sort chronologically by construction.
if [ "$KEEP" -gt 0 ]; then
  total="$(find "$OUT" -mindepth 1 -maxdepth 1 -type d -name '20*' | wc -l | tr -d ' ')"
  if [ "$total" -gt "$KEEP" ]; then
    find "$OUT" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | head -n "$((total - KEEP))" | while read -r old; do
      rm -rf "$old"
      echo "  pruned $(basename "$old")"
    done
  fi
fi

echo
cat "$DEST/MANIFEST.txt"
echo
echo "✓ $DEST"
echo "  Restore procedure: docs/RESTORE.md — and a backup nobody has restored is unverified."
