/**
 * Copy every object from one bucket to another and prove the copy — for the EU move
 * (docs/EU-REGION-MIGRATION.md). Read-only on the source: List + Get. Never deletes anything.
 *
 *   SRC_BUCKET=… SRC_ENDPOINT=… SRC_REGION=… SRC_ACCESS_KEY_ID=… SRC_SECRET_ACCESS_KEY=… \
 *   DST_BUCKET=… DST_ENDPOINT=… DST_REGION=… DST_ACCESS_KEY_ID=… DST_SECRET_ACCESS_KEY=… \
 *     node packages/db/scripts/bucket-copy.mjs [--verify-only]
 *
 * Run it twice: once ahead of the night (full copy) and once inside the window (only what changed —
 * an object already at the destination with the same size and SHA-256 is left alone). It ends by
 * re-reading BOTH sides and comparing every object's SHA-256; any difference is a non-zero exit.
 */
import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const verifyOnly = process.argv.includes("--verify-only");

function side(prefix) {
  const need = ["BUCKET", "ENDPOINT", "REGION", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY"];
  const missing = need.filter((k) => !process.env[`${prefix}_${k}`]);
  if (missing.length) {
    console.error(`ABORT: missing ${missing.map((k) => `${prefix}_${k}`).join(", ")}`);
    process.exit(2);
  }
  const v = (k) => process.env[`${prefix}_${k}`];
  return {
    bucket: v("BUCKET"),
    client: new S3Client({
      region: v("REGION"),
      endpoint: v("ENDPOINT"),
      forcePathStyle: true, // Railway addresses buckets by path — same as @revio/storage
      credentials: { accessKeyId: v("ACCESS_KEY_ID"), secretAccessKey: v("SECRET_ACCESS_KEY") },
    }),
  };
}

const src = side("SRC");
const dst = side("DST");
if (src.bucket === dst.bucket && process.env.SRC_ENDPOINT === process.env.DST_ENDPOINT) {
  console.error("ABORT: source and destination are the same bucket.");
  process.exit(2);
}

async function list({ client, bucket }) {
  const keys = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of page.Contents ?? []) keys.push({ key: o.Key, size: o.Size ?? 0 });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function read({ client, bucket }, key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await res.Body.transformToByteArray();
  return { body, contentType: res.ContentType, cacheControl: res.CacheControl, sha: createHash("sha256").update(body).digest("hex") };
}

const sourceKeys = await list(src);
let copied = 0;
let skipped = 0;
if (!verifyOnly) {
  for (const { key, size } of sourceKeys) {
    const s = await read(src, key);
    // Already there and identical — the delta pass on the night only moves what changed.
    try {
      const head = await dst.client.send(new HeadObjectCommand({ Bucket: dst.bucket, Key: key }));
      if (head.ContentLength === size) {
        const d = await read(dst, key);
        if (d.sha === s.sha) { skipped++; continue; }
      }
    } catch { /* not there yet */ }
    await dst.client.send(new PutObjectCommand({
      Bucket: dst.bucket, Key: key, Body: s.body,
      ...(s.contentType ? { ContentType: s.contentType } : {}),
      ...(s.cacheControl ? { CacheControl: s.cacheControl } : {}),
    }));
    copied++;
  }
}

// The proof: every source object exists at the destination with the same bytes and content type.
let bad = 0;
for (const { key } of sourceKeys) {
  const s = await read(src, key);
  let d;
  try { d = await read(dst, key); } catch { console.error(`MISSING  ${key}`); bad++; continue; }
  if (d.sha !== s.sha) { console.error(`DIFFERS  ${key}`); bad++; }
  else if ((s.contentType ?? "") !== (d.contentType ?? "")) { console.error(`TYPE     ${key}  ${s.contentType} → ${d.contentType}`); bad++; }
}
const bytes = sourceKeys.reduce((a, k) => a + k.size, 0);
console.log(`objects: ${sourceKeys.length} (${(bytes / 1024).toFixed(0)} KB) · copied ${copied} · already identical ${skipped} · verified ${sourceKeys.length - bad}/${sourceKeys.length}`);
process.exit(bad ? 1 : 0);
