/**
 * Where a hotel's uploaded logo lives, resolved the same way by every app that shows one.
 *
 * A logo can arrive two ways and they behave differently, which is the whole reason this file
 * exists. A hotel can **paste an absolute URL** (stored on the property) or **upload a file** (bytes
 * in `BrandAsset`, served by our own route). Uploading deliberately clears the pasted URL, so
 * reading the URL column alone reports "no logo" for every hotel that used the upload button — which
 * is exactly the bug this replaces: the booking-engine screen showed nothing for a hotel whose logo
 * was sitting in the database the whole time.
 *
 * Two kinds, one precedence:
 *
 * 1. the booking engine's **own** logo, if it has one;
 * 2. otherwise the **email** logo — a hotel that has branded its confirmation emails should not have
 *    to do it twice;
 * 3. otherwise nothing, and the page falls back to the hotel's name as a wordmark.
 *
 * The path is deliberately **relative**. Every app shares one database, so each serves the bytes
 * from its own `/api/brand/...` route rather than pointing at a sibling service. The previous
 * approach needed a `BRAND_ASSET_ORIGIN` environment variable to be set on every service that
 * displays a logo, and the day it was missing on one of them the guest-facing booking page rendered
 * a broken image — a config gap that could only fail in production.
 */

export type BrandLogoKind = "email" | "booking";

/** A logo the hotel uploaded: bytes in `BrandAsset`, served by our own route. */
export interface UploadedLogo {
  kind: BrandLogoKind;
  /** Anything that changes when the bytes do — `BrandAsset.updatedAt` is the natural choice. */
  version: string | number;
}

export function brandLogoPath(propertyId: string, logo: UploadedLogo): string {
  // `v` makes the URL change with the bytes, so the response can be cached hard and a hotel that
  // replaces its logo never sees the old one persist in a browser or a mail client.
  return `/api/brand/${propertyId}/logo?kind=${logo.kind}&v=${encodeURIComponent(String(logo.version))}`;
}

/**
 * The logo a surface should show, or null.
 *
 * `pastedUrl` is only consulted when nothing was uploaded, because uploading clears it — if both are
 * somehow present, the upload is the more recent intent.
 */
export function resolveBrandLogo(
  propertyId: string,
  opts: {
    /** The surface asking. A booking page prefers its own logo; email only ever wants the email one. */
    prefer: BrandLogoKind;
    uploaded: readonly UploadedLogo[];
    pastedUrl?: string | null;
  },
): string | null {
  const order: BrandLogoKind[] = opts.prefer === "booking" ? ["booking", "email"] : ["email"];
  for (const kind of order) {
    const hit = opts.uploaded.find((u) => u.kind === kind);
    if (hit) return brandLogoPath(propertyId, hit);
  }
  return opts.pastedUrl?.trim() || null;
}
