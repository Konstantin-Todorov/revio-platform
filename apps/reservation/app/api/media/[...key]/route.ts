import { NextResponse } from "next/server";
import { getObjectStore, isValidObjectKey } from "@revio/storage";

/**
 * Serves a stored object.
 *
 * Only reached when the store has no public origin — a configured bucket hands the browser a URL
 * that never touches this server, which is the point of using one. This route is what makes the
 * photo feature work on a laptop, and the fallback if a bucket is private.
 *
 * The route exists in BOTH apps because `publicUrl()` returns a relative path, so it resolves
 * against whichever app rendered the page; the CRS editor and the guest's page each serve their own.
 *
 * No auth: these are room photographs that the public booking page shows to anonymous guests, so
 * the key IS the capability. Keys are unguessable (a 12-byte random token) and validated below, and
 * nothing private is ever stored under this prefix.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  if (!isValidObjectKey(key)) return new NextResponse("Not found", { status: 404 });

  const store = await getObjectStore();
  const object = await store.get(key);
  if (!object) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(object.body), {
    headers: {
      "Content-Type": object.contentType,
      // The key contains a random token and an object is never rewritten in place, so a stale copy
      // is impossible and the cache can be as aggressive as the spec allows.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(object.body.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
