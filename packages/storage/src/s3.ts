import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ObjectStore, PutOptions } from "./store.js";
import { isValidObjectKey } from "./keys.js";

/**
 * S3-compatible object storage — this is what a Railway bucket is.
 *
 * `forcePathStyle` is on because Railway (and MinIO, and most non-AWS S3 implementations) address
 * buckets as `endpoint/bucket/key` rather than as a `bucket.` subdomain. Leaving it off is the
 * single most common reason an otherwise-correct S3 client 404s against a non-AWS endpoint.
 *
 * NOTE: written against the AWS SDK but NOT yet exercised against a real bucket — none exists on
 * the account yet. The local driver is what the photo feature currently runs on.
 */
export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Origin the browser fetches from — the bucket's public URL or a CDN in front of it. When set,
   * image requests never reach our server at all, which is the entire point of using a bucket.
   */
  publicBase?: string | undefined;
}

export class S3ObjectStore implements ObjectStore {
  readonly kind = "s3" as const;
  private readonly client: S3Client;
  private readonly cfg: S3Config;

  constructor(cfg: S3Config) {
    this.cfg = cfg;
    this.client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  private assertKey(key: string): string {
    if (!isValidObjectKey(key)) throw new Error("Invalid object key");
    return key;
  }

  async put(key: string, body: Uint8Array, opts: PutOptions): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: this.assertKey(key),
        Body: body,
        ContentType: opts.contentType,
        // Keys carry a random token and content is never rewritten in place, so a long immutable
        // cache is safe and is what keeps the public page fast.
        CacheControl: `public, max-age=${opts.cacheSeconds ?? 31536000}, immutable`,
      }),
    );
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.cfg.bucket, Key: this.assertKey(key) }),
      );
      const body = await res.Body?.transformToByteArray();
      if (!body) return null;
      return { body, contentType: res.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    // S3 delete is idempotent — a missing key is not an error, which is what we want when a row and
    // its object have already drifted apart.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: this.assertKey(key) }));
  }

  publicUrl(key: string): string {
    if (this.cfg.publicBase) return `${this.cfg.publicBase.replace(/\/$/, "")}/${key}`;
    // No public base configured: fall back to serving through our own route, which still works but
    // gives up the CDN. Better a slower page than a broken one.
    return `/api/media/${key}`;
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}
