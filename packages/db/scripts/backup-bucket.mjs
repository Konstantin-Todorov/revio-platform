/**
 * Mirror the storage bucket to a local directory — the other half of a real backup.
 *
 * `pg_dump` captures `RoomTypePhoto` and `BrandAsset` rows, which hold object KEYS. The bytes are in
 * the bucket. A database-only restore therefore produces a hotel whose rooms have no photographs and
 * whose booking page has no logo: every row present and correct, every image broken.
 *
 * Read-only against production — ListObjectsV2 + GetObject, nothing else.
 *
 *   node packages/db/scripts/backup-bucket.mjs <output-dir>
 *
 * Credentials come from the same STORAGE_* variables the apps use. Pulled from the `reservation`
 * service via the Railway CLI when they are not already in the environment, so this works from a
 * laptop without copying secrets into a file.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const out = process.argv[2];
if (!out) {
  console.error("usage: node backup-bucket.mjs <output-dir>");
  process.exit(2);
}

function env() {
  const need = ["STORAGE_BUCKET", "STORAGE_REGION", "STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"];
  if (need.every((k) => process.env[k])) return Object.fromEntries(need.map((k) => [k, process.env[k]]));
  const raw = execFileSync("railway", ["variables", "--service", "reservation", "--json"], { encoding: "utf8" });
  const v = JSON.parse(raw);
  const missing = need.filter((k) => !v[k]);
  if (missing.length) {
    console.error(`ABORT: the reservation service has no ${missing.join(", ")} — is object storage configured?`);
    process.exit(1);
  }
  return Object.fromEntries(need.map((k) => [k, v[k]]));
}

const cfg = env();
const client = new S3Client({
  region: cfg.STORAGE_REGION,
  endpoint: cfg.STORAGE_ENDPOINT,
  // Railway and MinIO address buckets by path, AWS by subdomain. Same reason it is set in
  // @revio/storage — without it a correct-looking client 404s on everything.
  forcePathStyle: true,
  credentials: { accessKeyId: cfg.STORAGE_ACCESS_KEY_ID, secretAccessKey: cfg.STORAGE_SECRET_ACCESS_KEY },
});

let token;
let count = 0;
let bytes = 0;
do {
  const page = await client.send(
    new ListObjectsV2Command({ Bucket: cfg.STORAGE_BUCKET, ContinuationToken: token }),
  );
  for (const obj of page.Contents ?? []) {
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.STORAGE_BUCKET, Key: obj.Key }));
    const body = await res.Body.transformToByteArray();
    const dest = join(out, obj.Key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body);
    count++;
    bytes += body.length;
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

console.log(`   ${count} objects, ${(bytes / 1024).toFixed(0)} KB from bucket "${cfg.STORAGE_BUCKET}"`);
// An empty bucket is legitimate for a hotel that has uploaded nothing, but it is also exactly what a
// misconfigured endpoint looks like. Say so rather than reporting a clean run.
if (count === 0) console.log("   NOTE: bucket is empty — expected only if no photos or logos exist yet.");
