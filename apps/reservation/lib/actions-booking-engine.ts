"use server";

import { revalidatePath } from "next/cache";
import { BOOKING_PRESET_BY_KEY } from "@revio/core";
import { slugifyPropertyName, slugRejectionReason } from "@revio/booking";
import { prisma } from "./db";
import { getProperty } from "./data";
import { getSession } from "./session";
import { logAudit, str } from "./mutation-helpers";

/**
 * Refuse to write while the user is in portfolio scope.
 *
 * In group scope `activePropertyId` resolves to whichever property sorts first, so a write here
 * would land on a hotel the user was not looking at — and the address it writes is permanent. The
 * layout already shows a property picker instead of this screen, but that is the render; this is
 * the POST, and only one of them is a security boundary.
 */
async function assertSingleProperty(): Promise<string | null> {
  const session = await getSession();
  if (session?.scope === "group") {
    return "Choose a hotel first — you are viewing all properties, and this setting belongs to one.";
  }
  return null;
}

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

/** Saving the look reports back, so the button can show progress and confirm. A save that produces
 *  no visible change is indistinguishable from a dead button — which is exactly how it read. */
export interface LookResult {
  ok: boolean;
  error?: string;
}

export async function saveBookingEngineLook(
  _prev: LookResult | null,
  fd: FormData,
): Promise<LookResult> {
  const scopeProblem = await assertSingleProperty();
  if (scopeProblem) return { ok: false, error: scopeProblem };

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
  return { ok: true };
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
  const scopeProblem = await assertSingleProperty();
  if (scopeProblem) return { ok: false, error: scopeProblem };

  const { id: propertyId, tenantId, name, publicSlug } = await getProperty();

  const raw = str(fd, "publicSlug");
  const enabled = fd.get("bookingEngineEnabled") != null;

  /**
   * The address is issued ONCE and then frozen.
   *
   * It is the one value here that escapes the product: printed on QR cards at reception, pasted into
   * an Instagram bio, handed to a print shop. Letting it be edited later means a hotel silently
   * breaks material already in the world — and because the old slug then resolves to nothing, the
   * failure lands on a guest trying to book, where nobody sees it.
   *
   * A rename is a support action with a redirect from the old address, not a text field. Enforced
   * HERE and not only in the UI: a read-only input is a suggestion, and this form is a POST.
   */
  if (publicSlug) {
    // The on/off switch stays editable — taking the channel down is reversible; the address is not.
    await prisma.property.update({ where: { id: propertyId }, data: { bookingEngineEnabled: enabled } });
    await logAudit(propertyId, tenantId, {
      entity: "Booking engine", field: "accepting bookings", newValue: enabled ? "on" : "off",
    });
    revalidatePath("/booking-engine");
    return { ok: true, slug: publicSlug };
  }

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
