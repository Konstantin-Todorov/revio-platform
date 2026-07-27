import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, resolve, sep } from "node:path";
import type { ObjectStore, PutOptions } from "./store.js";
import { isValidObjectKey } from "./keys.js";

/**
 * Disk-backed store for local development.
 *
 * Exists so the photo feature is completely usable before anyone provisions a bucket — the upload,
 * the gallery editor and the public page all work on a laptop, and switching to S3 later is an
 * environment variable rather than a code change.
 *
 * Every path is validated twice: the key must be one we could have produced, AND the resolved
 * absolute path must still sit inside the root. The second check is what actually stops a traversal,
 * because it survives any future mistake in the first.
 */
export class LocalObjectStore implements ObjectStore {
  readonly kind = "local" as const;
  private readonly root: string;

  constructor(dir: string) {
    // A RELATIVE dir resolves against the workspace root, not the process cwd.
    //
    // Each Next app runs from its own directory, so `.storage` relative to cwd would give RevioCRS
    // `apps/reservation/.storage` and RevioDirect `apps/booking/.storage` — the hotel uploads a
    // photo and the guest's page 404s it, with both apps insisting they are configured identically.
    // An absolute dir (what production sets) is used exactly as given.
    this.root = isAbsolute(dir) ? resolve(dir) : resolve(workspaceRoot(), dir);
  }

  private pathFor(key: string): string {
    if (!isValidObjectKey(key)) throw new Error("Invalid object key");
    const full = resolve(join(this.root, key));
    // `startsWith(root)` alone would accept `/data/storage-evil` for root `/data/storage`.
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error("Object key escapes the storage root");
    }
    return full;
  }

  async put(key: string, body: Uint8Array, opts: PutOptions): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
    // The content type is recovered from the extension on read; keys are always .webp today, and
    // a sidecar file per object would be a lot of ceremony for a dev-only driver.
    void opts;
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    try {
      const body = await readFile(this.pathFor(key));
      return { body: new Uint8Array(body), contentType: contentTypeFor(key) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string {
    return `/api/media/${key}`;
  }
}

/**
 * The monorepo root, found by walking up for the pnpm workspace marker.
 *
 * Falls back to the cwd when there is no marker — a single-app deployment or a test fixture — so
 * this is a convenience for local development, never a requirement.
 */
function workspaceRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir || parse(dir).root === dir) return process.cwd();
    dir = parent;
  }
}

function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return (
    { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", avif: "image/avif" }[ext] ??
    "application/octet-stream"
  );
}
