import "server-only";
import { brandLogoPath } from "@revio/core";
import { getObjectStore } from "@revio/storage";
import { getProperty } from "./data";
import { prisma } from "./db";

/**
 * What every Booking Engine section needs to know about the page, read once per request.
 *
 * The screen was one long page of six cards; it is now sections on the left (docs/UI-STANDARD.md §8),
 * and each section reads only what it shows — this module is the part they share.
 */
export async function bookingEnginePage() {
  const property = await getProperty();
  /**
   * The address guests actually use. `BOOKING_ENGINE_ORIGIN` is where the booking service runs for
   * this deployment; in production, unset means the service is not published yet — and showing a hotel
   * a `localhost` URL would be worse than none, because they would copy it.
   */
  const configured = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "");
  const origin = configured || (process.env.NODE_ENV === "development" ? "http://localhost:3004" : null);
  // The badge reports the HOTEL's decision, not our deployment status — see the Overview section.
  const accepting = property.bookingEngineEnabled && !!property.publicSlug;
  const url = property.publicSlug && origin ? `${origin}/${property.publicSlug}` : null;
  return { property, origin, published: origin !== null, accepting, url };
}

/**
 * Which logos this hotel actually has — read from `BrandAsset`, not the `*LogoUrl` columns, which
 * hold a PASTED url that uploading deliberately clears. `updatedAt` is the cache-buster.
 */
export async function bookingLogos(property: { id: string; bookingLogoUrl: string | null; emailLogoUrl: string | null }) {
  const assets = await prisma.brandAsset.findMany({
    where: { propertyId: property.id, kind: { in: ["email_logo", "booking_logo"] } },
    select: { kind: true, updatedAt: true },
  });
  const asset = (kind: string) => assets.find((a) => a.kind === kind);
  return {
    ownLogo: asset("booking_logo")
      ? brandLogoPath(property.id, { kind: "booking", version: asset("booking_logo")!.updatedAt.getTime() })
      : property.bookingLogoUrl,
    emailLogo: asset("email_logo")
      ? brandLogoPath(property.id, { kind: "email", version: asset("email_logo")!.updatedAt.getTime() })
      : property.emailLogoUrl,
  };
}

/** The hero's THUMB — the editor judges a crop and a shading, and a 2400px photo is bytes paid for nothing. */
export async function bookingHeroThumb(key: string | null): Promise<string | null> {
  return key ? (await getObjectStore()).publicUrl(key) : null;
}
