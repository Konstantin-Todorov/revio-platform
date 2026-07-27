import "server-only";
import { cache } from "react";
import { forSystem } from "@revio/db";
import { BOOKING_COPY_DEFAULTS } from "@revio/core";

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
  headline: string;
  subheadline: string;
  showTrust: boolean;
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
      bookingPreset: true, bookingBrandColor: true, bookingFont: true, bookingLogoUrl: true,
      bookingHeadline: true, bookingSubheadline: true, bookingShowTrust: true,
      tenant: { select: { status: true, hasReservation: true } },
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
    logoUrl: property.bookingLogoUrl?.trim() || logoFor(property),
    // The engine offers sans/serif only; an email hotel on "mixed" means serif headings there, and
    // serif headings are the closest honest equivalent here.
    font: property.bookingFont ?? (property.emailFont === "sans" ? "sans" : "serif"),
    preset: property.bookingPreset,
    headline: property.bookingHeadline?.trim() || BOOKING_COPY_DEFAULTS.headline,
    subheadline: property.bookingSubheadline?.trim() || BOOKING_COPY_DEFAULTS.subheadline,
    showTrust: property.bookingShowTrust,
  };
});

/**
 * The hotel's logo. An uploaded logo is served from the CM's public brand route — the same bytes the
 * guest emails use, so a hotel that has set up its email branding already has a branded booking page
 * with no extra step.
 */
function logoFor(p: { id: string; emailLogoUrl: string | null; emailLogoVersion: number }): string | null {
  if (p.emailLogoVersion > 0) {
    const base = process.env.BRAND_ASSET_ORIGIN ?? "";
    return `${base}/api/brand/${p.id}/logo?v=${p.emailLogoVersion}`;
  }
  return p.emailLogoUrl?.trim() || null;
}
