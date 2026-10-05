import "server-only";
import { guestPaymentsConfigured, isMockAccount, testChargesOnPlatform } from "@revio/payments";
import { cache } from "react";
import { forSystem } from "@revio/db";
import { heroFocalY, heroScrim, resolveBrandLogo, RATING_SOURCES, ratingShown, type RatingSource } from "@revio/core";
import { getObjectStore } from "@revio/storage";

/**
 * Resolving a public slug → the hotel it belongs to.
 *
 * This is the ONE place the booking engine crosses from "anonymous internet visitor" to "a specific
 * property", so the rules live here rather than being repeated per route.
 *
 * The system perimeter is used deliberately: an unauthenticated request carries no tenant context,
 * so there is nothing to scope by until the slug has been resolved. Everything downstream then
 * scopes to the tenant this returns — the same shape as the connectivity sync and the brand-logo
 * route.
 */

const prisma = forSystem();

export interface HeroBackground {
  url: string;
  /** `object-position` Y, 0–100 — which band of the photo survives the crop. */
  focalY: number;
  /** Opacity of the black scrim over it. MEASURED from the image, then raised by the hotel's choice. */
  alpha: number;
  /** For `width`/`height` on the image, so the band does not reflow as the photo arrives. */
  width: number | null;
  height: number | null;
}

export interface PublicProperty {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  timezone: string;
  baseCurrency: string;
  defaultLanguage: string;
  checkInTime: string;
  checkOutTime: string;
  address: string | null;
  phone: string | null;
  contactEmail: string | null;
  /**
   * Presentation. Each field is the engine's OWN setting where the hotel has made one, falling back
   * to their email branding where they have not — so switching the engine on inherits a coherent
   * look with no second round of branding work, and editing it here never touches their email.
   */
  brandColor: string | null;
  logoUrl: string | null;
  font: string;
  preset: string;
  headline: string | null;
  subheadline: string | null;
  showTrust: boolean;
  /** Public review scores the hotel quoted, already filtered to the ones shown (see core/booking/ratings). */
  ratings: { source: RatingSource; scoreTenths: number; reviewCount: number | null; url: string | null }[];
  /**
   * The hotel's own photograph behind the headline, ready to render.
   *
   * Resolved here rather than in the page for the same reason the logo is: the screens read a
   * resolved value, never the raw columns. `alpha` in particular must never be recomputed at a call
   * site — it is a contrast guarantee, and a second place to derive it is a second place to get it
   * wrong. Null means no background, which is a designed state: the preset's own hero still runs.
   */
  hero: HeroBackground | null;
  /**
   * Can this hotel actually take a card guarantee right now?
   *
   * Mirrors Stripe's own `charges_enabled` on the hotel's connected account (spec §2.5③). False
   * means the booking engine runs in **request-to-book** mode: no card step, and the stay arrives as
   * `requested` for the hotel to accept. A hotel is never blocked from selling while its Stripe
   * paperwork clears — it just cannot promise an instant confirmation, and the page says so.
   */
  paymentReady: boolean;
  /**
   * The hotel's own Stripe account, which a guest's payment is made ON. Null only in the local
   * platform-test mode (`STRIPE_TEST_CHARGE_PLATFORM`), where the sandbox platform stands in for it.
   */
  paymentAccountId: string | null;
}

/**
 * The property behind a slug, or null.
 *
 * Returns null for a disabled engine, a suspended tenant, or an inactive property — all of which
 * must look identical from outside. Distinguishing them would leak which hotels are Revio customers
 * and which have stopped paying, so the caller renders one generic not-found for every case.
 *
 * `cache()` de-duplicates within a single render pass: the layout and the page both need it, and a
 * public page should not hit the database twice for the same row.
 */
export const getPublicProperty = cache(async (slug: string): Promise<PublicProperty | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const property = await prisma.property.findUnique({
    where: { publicSlug: normalized },
    select: {
      id: true, tenantId: true, name: true, publicSlug: true, timezone: true, baseCurrency: true,
      defaultLanguage: true, checkInTime: true, checkOutTime: true, address: true, phone: true,
      contactEmail: true, status: true, bookingEngineEnabled: true,
      emailBrandColor: true, emailLogoUrl: true, emailLogoVersion: true, emailFont: true,
      // Which logos exist, and when they last changed — see `logoFor`.
      brandAssets: { select: { kind: true, updatedAt: true } },
      stripeChargesEnabled: true,
      stripeAccountId: true,
      bookingPreset: true, bookingBrandColor: true, bookingFont: true, bookingLogoUrl: true,
      bookingHeadline: true, bookingSubheadline: true, bookingShowTrust: true,
      bookingHeroKey: true, bookingHeroWidth: true, bookingHeroHeight: true,
      bookingHeroLuminance: true, bookingHeroFocalY: true, bookingHeroOverlay: true,
      tenant: { select: { status: true, hasReservation: true } },
      publicRatings: { select: { source: true, scoreTenths: true, reviewCount: true, url: true, confirmedAt: true } },
    },
  });

  if (!property) return null;
  if (!property.bookingEngineEnabled) return null;
  if (property.status !== "active") return null;
  if (property.tenant.status !== "active") return null;
  // The engine sells through the CRS's reservation record; without that entitlement there is
  // nothing to book into.
  if (!property.tenant.hasReservation) return null;

  return {
    id: property.id,
    tenantId: property.tenantId,
    name: property.name,
    slug: property.publicSlug!,
    timezone: property.timezone,
    baseCurrency: property.baseCurrency,
    defaultLanguage: property.defaultLanguage,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    address: property.address,
    phone: property.phone,
    contactEmail: property.contactEmail,
    // `??` not `||`: an empty string is a hotel who cleared the field, which should still fall back,
    // and `trim() || null` upstream turns blanks into nulls — so both spellings land on the default.
    brandColor: property.bookingBrandColor ?? property.emailBrandColor,
    // All four cases (own upload → email upload → own pasted URL → email pasted URL) resolve in one
    // place. Checking `bookingLogoUrl` here as well would let a stale pasted link outrank the file
    // the hotel just uploaded.
    logoUrl: logoFor(property),
    // The engine offers sans/serif only; an email hotel on "mixed" means serif headings there, and
    // serif headings are the closest honest equivalent here.
    font: property.bookingFont ?? (property.emailFont === "sans" ? "sans" : "serif"),
    preset: property.bookingPreset,
    // Null when the hotel wrote none: the page then shows OUR default copy in the guest's language
    // (`guest.hero`). The hotel's own words are shown as written, in whatever language they wrote.
    headline: property.bookingHeadline?.trim() || null,
    subheadline: property.bookingSubheadline?.trim() || null,
    showTrust: property.bookingShowTrust,
    ratings: RATING_SOURCES.flatMap((source) => {
      const r = property.publicRatings.find((x) => x.source === source);
      return r && ratingShown({ source, scoreTenths: r.scoreTenths, confirmedAt: r.confirmedAt }, new Date())
        ? [{ source, scoreTenths: r.scoreTenths, reviewCount: r.reviewCount, url: r.url }]
        : [];
    }),
    hero: property.bookingHeroKey
      ? {
          url: (await getObjectStore()).publicUrl(property.bookingHeroKey),
          focalY: heroFocalY(property.bookingHeroFocalY),
          alpha: heroScrim(property.bookingHeroLuminance, property.bookingHeroOverlay).alpha,
          width: property.bookingHeroWidth,
          height: property.bookingHeroHeight,
        }
      : null,
    // Three things must all be true to take a card: Stripe says the hotel's account accepts charges,
    // that account exists, and this deployment is configured to take guest payments at all. Any one
    // missing is request-to-book — never a card form that cannot charge.
    paymentReady:
      (property.stripeChargesEnabled && !!property.stripeAccountId && !isMockAccount(property.stripeAccountId) && guestPaymentsConfigured()) || testChargesOnPlatform(),
    paymentAccountId: property.stripeChargesEnabled && property.stripeAccountId && !isMockAccount(property.stripeAccountId) ? property.stripeAccountId : null,
  };
});

/**
 * The hotel's logo: its own if it uploaded one for this page, otherwise the email one.
 *
 * Served from **this app's** `/api/brand/…` route. It used to point at the CM's copy via a
 * `BRAND_ASSET_ORIGIN` variable, which was never set on this service — so the URL came out relative,
 * hit a route that does not exist here, and a hotel that had uploaded a perfectly good logo got a
 * broken image on its own guest-facing booking page. Every app shares one database; each can serve
 * the bytes itself, and then there is no variable to forget.
 *
 * `updatedAt` is the cache-buster, so replacing a logo replaces it everywhere immediately.
 */
function logoFor(p: {
  id: string;
  emailLogoUrl: string | null;
  bookingLogoUrl: string | null;
  brandAssets: { kind: string; updatedAt: Date }[];
}): string | null {
  return resolveBrandLogo(p.id, {
    prefer: "booking",
    uploaded: p.brandAssets
      .filter((a) => a.kind === "booking_logo" || a.kind === "email_logo")
      .map((a) => ({
        kind: a.kind === "booking_logo" ? ("booking" as const) : ("email" as const),
        version: a.updatedAt.getTime(),
      })),
    // Only consulted when nothing was uploaded — uploading clears these by design.
    pastedUrl: p.bookingLogoUrl?.trim() || p.emailLogoUrl,
  });
}
