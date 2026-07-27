/**
 * Object keys — the one place that decides where a file lives.
 *
 * Keys are derived, never taken from user input. A filename that arrives from a browser is
 * attacker-controlled: `../../` escapes the prefix, a leading `/` changes the root, and a name that
 * collides with an existing key silently overwrites another hotel's photo. So the caller supplies
 * ids we already trust and a random token, and the extension is chosen by us from the format we
 * actually encoded — not from what the upload claimed to be.
 *
 * The tenant id leads the path so a bucket listing is grouped the way a support question is asked
 * ("what does this hotel have?") and so a future per-tenant lifecycle rule is one prefix.
 */

/** Characters that are safe in an S3 key and in a URL path segment without escaping. */
const SAFE = /^[a-zA-Z0-9_-]+$/;

export type ImageVariant = "full" | "thumb";

export interface PhotoKeyParts {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  /** Random, unique per uploaded photo — NOT the original filename. */
  token: string;
  variant: ImageVariant;
}

export function roomPhotoKey({ tenantId, propertyId, roomTypeId, token, variant }: PhotoKeyParts): string {
  for (const [name, part] of Object.entries({ tenantId, propertyId, roomTypeId, token })) {
    if (!SAFE.test(part)) throw new Error(`Unsafe object key part: ${name}`);
  }
  return `t/${tenantId}/p/${propertyId}/rooms/${roomTypeId}/${token}-${variant}.webp`;
}

/**
 * Is this a key we could have produced?
 *
 * The serving route takes a key from the URL, so it must refuse anything that could walk out of the
 * prefix or reach a file we never wrote — even though the local driver also resolves and re-checks
 * the final path. Two independent checks, because a single one is a single mistake away from a
 * directory traversal.
 */
export function isValidObjectKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (key.startsWith("/") || key.includes("//")) return false;
  if (key.includes("\\") || key.includes("\0")) return false;

  return key.split("/").every((seg) => {
    // `.` and `..` have to be rejected as whole SEGMENTS, not as substrings: a dot is legal inside
    // a filename (`abc123-full.webp`), so a substring check would either reject every real key or
    // — as an earlier version did — accept `t/./p`, which is a non-canonical alias for `t/p`.
    if (seg === "." || seg === "..") return false;
    return seg.length > 0 && /^[a-zA-Z0-9._-]+$/.test(seg);
  });
}

/** A short, URL-safe, collision-resistant token for one photo. */
export function photoToken(): string {
  // 16 bytes of randomness, base36-ish via hex — plenty for per-room-type uniqueness, and short
  // enough to keep keys readable in a bucket listing.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
