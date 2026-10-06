/**
 * The hotel's own analytics and ad tags on its booking page — Google Analytics 4 and the Meta pixel.
 *
 * Both are the HOTEL's: its measurement id, its pixel, its data, under its own privacy notice. Revio
 * only carries them, and only after the guest has said yes — ePrivacy (and the Bulgarian ЗЕС) require
 * consent before a non-essential tag runs, so RevioDirect shows its consent banner only when one of
 * these is set, and loads nothing until the guest accepts.
 *
 * Pure: shape checks for what a hotel types into RevioCRS. A value that does not look like the id is
 * refused rather than stored, because a mistyped id is a tag that silently measures nothing.
 */

/** "G-ABC123XYZ" — a GA4 measurement id. Upper-cased; null when it is not one. */
export function normaliseGa4Id(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  return /^G-[A-Z0-9]{4,15}$/.test(v) ? v : null;
}

/** A Meta (Facebook) pixel id — digits only, 8 to 20 of them; null when it is not one. */
export function normaliseMetaPixelId(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\s+/g, "");
  return /^\d{8,20}$/.test(v) ? v : null;
}

/** Does this booking page need to ask for consent at all? Only when a tag is configured. */
export function needsConsent(tags: { ga4Id: string | null; metaPixelId: string | null }): boolean {
  return Boolean(tags.ga4Id || tags.metaPixelId);
}
