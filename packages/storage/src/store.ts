/**
 * Object storage behind one interface.
 *
 * Room photos do NOT go in Postgres. A hotel with six room types and eight photos each is ~50 MB
 * per property; at a hundred properties that is 5 GB inside the row store — which bloats every
 * backup and restore, costs an order of magnitude more per GB than object storage, and puts every
 * image request through the Next server instead of a CDN edge. The email LOGO is in Postgres and
 * that is fine: it is one ~20 KB file per property. The difference is volume, not principle.
 * (See docs/specs/BOOKING-ENGINE-DESIGN.md §2.6.)
 *
 * Two drivers behind the same interface:
 *  - **local** — writes under .storage/ and serves through a Next route. What runs on a laptop, so
 *    the photo feature is fully usable before any bucket exists.
 *  - **s3** — any S3-compatible bucket, which is what Railway's object storage is.
 *
 * The driver is chosen by environment, never by a caller, so no screen can accidentally hardcode
 * one and behave differently in production than it did in review.
 */

export interface PutOptions {
  contentType: string;
  /** Seconds. Content is immutable (the key contains a random token), so this can be aggressive. */
  cacheSeconds?: number;
}

export interface ObjectStore {
  readonly kind: "local" | "s3";
  put(key: string, body: Uint8Array, opts: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  /** Bytes, or null when the key does not exist. Used by the local serving route. */
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  /**
   * The URL a browser should request. For s3 with a public base this is the bucket/CDN origin —
   * the request never touches our server. For local it is our own serving route.
   */
  publicUrl(key: string): string;
}

let cached: ObjectStore | null = null;

/**
 * The store for this process.
 *
 * Cached because the S3 client holds a connection pool; building one per request would leak sockets
 * under any real upload volume.
 */
export async function getObjectStore(): Promise<ObjectStore> {
  if (cached) return cached;

  const bucket = process.env.STORAGE_BUCKET?.trim();
  if (bucket) {
    const { S3ObjectStore } = await import("./s3.js");
    cached = new S3ObjectStore({
      bucket,
      region: process.env.STORAGE_REGION?.trim() || "us-east-1",
      endpoint: process.env.STORAGE_ENDPOINT?.trim() || undefined,
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID?.trim() || "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY?.trim() || "",
      publicBase: process.env.STORAGE_PUBLIC_BASE?.trim() || undefined,
    });
  } else {
    const { LocalObjectStore } = await import("./local.js");
    cached = new LocalObjectStore(process.env.STORAGE_LOCAL_DIR?.trim() || ".storage");
  }
  return cached;
}

/** Test seam — lets a suite swap in a fake without touching the environment. */
export function __setObjectStore(store: ObjectStore | null): void {
  cached = store;
}
