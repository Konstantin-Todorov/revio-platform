/**
 * The hotel's public review scores, shown on its booking page as a trust badge.
 *
 * ENTERED BY THE HOTEL, copied from the public page, never collected by us: soliciting reviews from
 * guests is on hold (docs/specs/REVIEW-REQUESTS.md — OTA contracts), and quoting a score the hotel
 * already holds in public touches no guest at all. Every badge links to its source, so a guest can
 * check the number, and carries the date it was last confirmed, so a stale one reads as stale.
 */
export type RatingSource = "booking" | "google";
export const RATING_SOURCES: readonly RatingSource[] = ["booking", "google"];

/** Booking.com scores out of 10, Google out of 5 — stored in tenths so 9.1 is 91 and 4.7 is 47. */
export const RATING_MAX_TENTHS: Record<RatingSource, number> = { booking: 100, google: 50 };
/** Below this, a score is not a reason to book here — the hotel can still enter it; we do not show it. */
export const RATING_SHOW_FROM_TENTHS: Record<RatingSource, number> = { booking: 70, google: 35 };
/** A score not confirmed for this long is hidden: an old number is a claim nobody stands behind. */
export const RATING_STALE_DAYS = 365;

/** "9,1" / "9.1" / "9" → 91; null when it is not a score on that source's scale. */
export function parseRatingTenths(source: RatingSource, raw: string | null | undefined): number | null {
  const t = (raw ?? "").trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return null;
  const tenths = Math.round(Number(t) * 10);
  return tenths >= 10 && tenths <= RATING_MAX_TENTHS[source] ? tenths : null;
}

export function formatRating(tenths: number, locale: string): string {
  return (tenths / 10).toLocaleString(locale === "bg" ? "bg-BG" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Only a link to that source's own site — the badge must lead to the real page, not anywhere. */
export function ratingUrlAllowed(source: RatingSource, url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (source === "booking") return h === "booking.com" || h.endsWith(".booking.com");
  return h === "g.page" || h === "maps.app.goo.gl" || h === "goo.gl" || /(^|\.)google\.[a-z.]+$/.test(h);
}

/** Whether a stored score goes on the page today. */
export function ratingShown(r: { source: RatingSource; scoreTenths: number; confirmedAt: Date }, now: Date): boolean {
  const ageDays = (now.getTime() - r.confirmedAt.getTime()) / 86_400_000;
  return r.scoreTenths >= RATING_SHOW_FROM_TENTHS[r.source] && ageDays <= RATING_STALE_DAYS;
}
