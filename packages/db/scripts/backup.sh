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
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT/$STAMP"
mkdir -p "$DEST"

echo "→ resolving connection details from Railway"
PROD_URL="$(railway variables --service Postgres --json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).DATABASE_PUBLIC_URL')"

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
  echo "server version:   $(psql "$PROD_URL" -tAc 'SHOW server_version;')"
  echo "database size:    $(psql "$PROD_URL" -tAc 'SELECT pg_size_pretty(pg_database_size(current_database()));')"
  echo "latest migration: $(psql "$PROD_URL" -tAc 'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1;')"
  echo "dump bytes:       $(wc -c < "$DEST/database.dump" | tr -d ' ')"
  echo "bucket objects:   $(find "$DEST/bucket" -type f 2>/dev/null | wc -l | tr -d ' ')"
} > "$DEST/MANIFEST.txt"

echo
cat "$DEST/MANIFEST.txt"
echo
echo "✓ $DEST"
echo "  Restore procedure: docs/RESTORE.md — and a backup nobody has restored is unverified."
