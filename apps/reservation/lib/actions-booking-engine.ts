"use server";

import { revalidatePath } from "next/cache";
import { BOOKING_PRESET_BY_KEY } from "@revio/core";
import { slugifyPropertyName, slugRejectionReason } from "@revio/booking";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, str } from "./mutation-helpers";

/**
 * The booking engine's own settings.
 *
 * Deliberately separate from `saveEmailBranding`: a hotel editing their booking page must never
 * silently restyle the confirmation emails they already approved. Every field here is nullable and
 * blank means "inherit from the email branding", so a hotel can adopt one field at a time.
 */

const FONTS = new Set(["sans", "serif"]);

/** Blank → null, so "inherit" and "cleared" are the same stored state rather than two. */
function orNull(fd: FormData, key: string): string | null {
  return str(fd, key).trim() || null;
}

export async function saveBookingEngineLook(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();

  const preset = str(fd, "bookingPreset");
  const font = str(fd, "bookingFont").trim();
  const color = orNull(fd, "bookingBrandColor");

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      // An unknown preset would render an unstyled page, so a bad value keeps the current one.
      ...(BOOKING_PRESET_BY_KEY[preset] ? { bookingPreset: preset } : {}),
      bookingFont: FONTS.has(font) ? font : null,
      // A malformed hex would silently fall back to the platform default and look like a bug to
      // the hotel, so it is rejected into "inherit" instead of stored.
      bookingBrandColor: color && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color) ? color : null,
      bookingLogoUrl: orNull(fd, "bookingLogoUrl"),
      bookingHeadline: orNull(fd, "bookingHeadline"),
      bookingSubheadline: orNull(fd, "bookingSubheadline"),
      bookingShowTrust: fd.get("bookingShowTrust") != null,
    },
  });

  await logAudit(propertyId, tenantId, {
    entity: "Booking engine", field: "appearance", newValue: preset,
  });
  revalidatePath("/booking-engine");
}

/**
 * The public address and the on/off switch.
 *
 * Split from the look for a reason: this is the only setting on the screen with consequences
 * outside the page. The slug ends up in printed QR codes and Instagram bios, and turning the engine
 * off takes a live sales channel down — neither belongs behind the same button as a colour picker.
 */
export interface LinkResult {
  ok: boolean;
  error?: string;
  slug?: string;
}

export async function saveBookingEngineLink(_prev: LinkResult | null, fd: FormData): Promise<LinkResult> {
  const { id: propertyId, tenantId, name } = await getProperty();

  const raw = str(fd, "publicSlug");
  const enabled = fd.get("bookingEngineEnabled") != null;

  // Falls back to the hotel's name so a hotel that just flips the switch still gets a working link.
  const slug = slugifyPropertyName(raw || name);
  const problem = slugRejectionReason(slug);
  if (problem) return { ok: false, error: problem };

  // Unique across the whole platform — it resolves a property with no tenant context, so a
  // collision would hand one hotel's bookings to another. Checked here for a readable message
  // rather than letting the unique index throw.
  const taken = await prisma.property.findFirst({
    where: { publicSlug: slug, NOT: { id: propertyId } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: `"${slug}" is already taken. Try adding your city or district.` };

  await prisma.property.update({
    where: { id: propertyId },
    data: { publicSlug: slug, bookingEngineEnabled: enabled },
  });

  await logAudit(propertyId, tenantId, {
    entity: "Booking engine", field: "link", newValue: `${slug} · ${enabled ? "live" : "off"}`,
  });
  revalidatePath("/booking-engine");
  return { ok: true, slug };
}
