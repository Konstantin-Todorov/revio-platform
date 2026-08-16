import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalObjectStore } from "./local.js";
import { heroImageKey, isValidObjectKey, photoToken, roomPhotoKey } from "./keys.js";

/**
 * Object keys are the security boundary of this package: the serving route takes one from a URL,
 * and the writer builds one from ids. Both sides are attacker-reachable, so both are tested against
 * traversal rather than trusted to "look fine".
 */

let root: string;
let store: LocalObjectStore;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "revio-storage-"));
  store = new LocalObjectStore(root);
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const parts = { tenantId: "tenA", propertyId: "propB", roomTypeId: "rtC", token: "abc123" } as const;

describe("roomPhotoKey", () => {
  it("puts the tenant first so a bucket listing groups the way a support question is asked", () => {
    expect(roomPhotoKey({ ...parts, variant: "full" })).toBe("t/tenA/p/propB/rooms/rtC/abc123-full.webp");
  });

  it("gives the two variants different keys", () => {
    expect(roomPhotoKey({ ...parts, variant: "full" })).not.toBe(roomPhotoKey({ ...parts, variant: "thumb" }));
  });

  it("refuses to build a key from an id containing path characters", () => {
    // The ids come from our own database today, but a key is forever — this is the guard that stops
    // a future caller from ever passing user input through.
    for (const bad of ["../evil", "a/b", "a b", "", "a\0b", "..%2f"]) {
      expect(() => roomPhotoKey({ ...parts, tenantId: bad, variant: "full" }), bad).toThrow();
      expect(() => roomPhotoKey({ ...parts, token: bad, variant: "full" }), bad).toThrow();
    }
  });
});

describe("heroImageKey", () => {
  it("keeps the hero out of the rooms prefix", () => {
    // Not cosmetic: a room type's photos are deletable by prefix, and the hotel's own front-door
    // picture must not be inside the range that sweep would take.
    expect(heroImageKey({ ...parts, variant: "full" })).toBe("t/tenA/p/propB/hero/abc123-full.webp");
    expect(heroImageKey({ ...parts, variant: "full" })).not.toContain("/rooms/");
  });

  it("refuses to build a key from an id containing path characters", () => {
    for (const bad of ["../evil", "a/b", "a b", "", "a\0b", "..%2f"]) {
      expect(() => heroImageKey({ ...parts, propertyId: bad, variant: "full" }), bad).toThrow();
      expect(() => heroImageKey({ ...parts, token: bad, variant: "full" }), bad).toThrow();
    }
  });
});

describe("isValidObjectKey", () => {
  it("accepts the keys we actually produce", () => {
    expect(isValidObjectKey(roomPhotoKey({ ...parts, variant: "full" }))).toBe(true);
    expect(isValidObjectKey(heroImageKey({ ...parts, variant: "full" }))).toBe(true);
  });

  it("rejects traversal, absolute paths and empty segments", () => {
    for (const bad of [
      "", "/etc/passwd", "../../etc/passwd", "t/../../../etc/passwd", "t//p", "t/./p",
      "t\\p", "t/p\0", "t/ /p", "t/p?x=1", "t/p#frag",
    ]) {
      expect(isValidObjectKey(bad), bad).toBe(false);
    }
  });

  it("rejects an absurdly long key", () => {
    expect(isValidObjectKey("a/".repeat(400) + "b")).toBe(false);
  });
});

describe("photoToken", () => {
  it("is URL-safe and does not collide across a realistic upload volume", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const t = photoToken();
      expect(t).toMatch(/^[a-f0-9]{24}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(5000);
  });
});

describe("LocalObjectStore", () => {
  const key = roomPhotoKey({ ...parts, variant: "full" });
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);

  it("round-trips an object and creates nested directories on the way", async () => {
    await store.put(key, bytes, { contentType: "image/webp" });
    const got = await store.get(key);
    expect(got).not.toBeNull();
    expect(Array.from(got!.body)).toEqual([1, 2, 3, 4, 5]);
    expect(got!.contentType).toBe("image/webp");
  });

  it("returns null for a key that was never written, rather than throwing", async () => {
    // The serving route turns null into a 404; a throw would be a 500 for a normal missing image.
    expect(await store.get(roomPhotoKey({ ...parts, token: "nothinghere", variant: "full" }))).toBeNull();
  });

  it("deletes, and deleting twice is not an error", async () => {
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    await expect(store.delete(key)).resolves.toBeUndefined();
  });

  it("refuses to read outside its root even when the key sneaks past a naive check", async () => {
    const secret = join(root, "..", "revio-secret.txt");
    await writeFile(secret, "top secret");
    try {
      for (const bad of ["../revio-secret.txt", "t/../../revio-secret.txt", "/etc/passwd"]) {
        await expect(store.get(bad), bad).rejects.toThrow();
      }
    } finally {
      await rm(secret, { force: true });
    }
  });

  it("refuses to write outside its root", async () => {
    await expect(store.put("../escaped.webp", bytes, { contentType: "image/webp" })).rejects.toThrow();
  });

  it("does not treat a sibling directory with the same prefix as inside the root", async () => {
    // `resolve(root + key).startsWith(root)` would accept /tmp/revio-storage-XYZ-evil for root
    // /tmp/revio-storage-XYZ. The separator check is what makes that fail.
    const sibling = `${root}-evil`;
    await mkdir(sibling, { recursive: true });
    await writeFile(join(sibling, "x.webp"), "nope");
    try {
      await expect(store.get("../" + sibling.split("/").pop() + "/x.webp")).rejects.toThrow();
    } finally {
      await rm(sibling, { recursive: true, force: true });
    }
  });

  it("serves through our own route, since local disk has no public origin", () => {
    expect(store.publicUrl(key)).toBe(`/api/media/${key}`);
  });

  it("puts two apps started from different directories on the SAME relative root", async () => {
    // The bug this prevents: RevioCRS runs from apps/reservation and RevioDirect from apps/booking,
    // so a cwd-relative `.storage` silently gives them separate stores — upload works, guest 404s.
    const cwd = process.cwd();
    try {
      process.chdir(join(cwd, "src"));
      const fromSubdir = new LocalObjectStore(".storage-shared-probe");
      process.chdir(cwd);
      const fromRoot = new LocalObjectStore(".storage-shared-probe");
      // Both resolve to the workspace root, so a write by one is readable by the other.
      await fromSubdir.put(key, bytes, { contentType: "image/webp" });
      const got = await fromRoot.get(key);
      expect(got).not.toBeNull();
      await fromRoot.delete(key);
    } finally {
      process.chdir(cwd);
      await rm(join(cwd, "..", "..", ".storage-shared-probe"), { recursive: true, force: true });
    }
  });

  it("writes where the key says, so a bucket sync would land in the same layout", async () => {
    await store.put(key, bytes, { contentType: "image/webp" });
    const onDisk = await readFile(join(root, key));
    expect(Array.from(onDisk)).toEqual([1, 2, 3, 4, 5]);
    await store.delete(key);
  });
});
