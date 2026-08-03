"use server";

import { revalidatePath } from "next/cache";
import { BOOKING_PRESET_BY_KEY } from "@revio/core";
import { createConnectAccount, createOnboardingLink, getConnectStatus } from "@revio/payments";
import { syncRealChannels } from "@revio/connectivity";
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

/* ---------------------------------------------------------------------------------------------
 * The booking page's own logo.
 *
 * A hotel that has already uploaded a logo for its guest emails gets it here for free — that
 * inheritance is the point of every nullable `booking*` column. But "inherit or paste a URL" was the
 * only choice on offer, which is a strange thing to ask of someone who uploaded a file two screens
 * ago. So the booking page gets the same upload button, writing a second `BrandAsset` row under
 * `kind = "booking_logo"`.
 *
 * No migration: `BrandAsset` is keyed by `(propertyId, kind)` and `kind` was always a free string
 * with "more later: invoice logo, favicon" written next to it. Removing the upload falls back to
 * inheriting the email logo rather than to nothing, which is what a hotel means by "remove" here.
 * ------------------------------------------------------------------------------------------- */

/**
 * The file signatures we will store, checked against the leading bytes rather than the declared
 * type. A browser sends whatever the file claims to be; a renamed script must not be stored and
 * later served back as an image. SVG is absent deliberately — it can carry script.
 */
const LOGO_TYPES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};
const MAX_LOGO_BYTES = 300 * 1024;

export async function uploadBookingLogo(_prev: LookResult | null, fd: FormData): Promise<LookResult> {
  const scopeError = await assertSingleProperty();
  if (scopeError) return { ok: false, error: scopeError };
  const { id: propertyId, tenantId } = await getProperty();

  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first." };
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: `That image is ${Math.round(file.size / 1024)} KB. Please use one under 300 KB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const match = Object.entries(LOGO_TYPES).find(([, sig]) => sig.every((b, i) => bytes[i] === b));
  if (!match) return { ok: false, error: "That file isn’t a PNG, JPEG, GIF or WebP." };
  const [mimeType] = match;

  await prisma.brandAsset.upsert({
    where: { propertyId_kind: { propertyId, kind: "booking_logo" } },
    create: { tenantId, propertyId, kind: "booking_logo", mimeType, bytes, byteSize: bytes.length },
    update: { mimeType, bytes, byteSize: bytes.length },
  });
  // An uploaded file and a pasted URL are two answers to one question. Clearing the URL means the
  // hotel never ends up with a stale link quietly winning over the file they just chose.
  await prisma.property.update({ where: { id: propertyId }, data: { bookingLogoUrl: null } });

  await logAudit(propertyId, tenantId, {
    entity: "Booking engine", field: "logo", newValue: `uploaded (${Math.round(bytes.length / 1024)} KB)`,
  });
  revalidatePath("/booking-engine");
  return { ok: true };
}

/** Drop the booking page's own logo — it goes back to inheriting the email one. */
export async function removeBookingLogo(): Promise<void> {
  if (await assertSingleProperty()) return;
  const { id: propertyId, tenantId } = await getProperty();
  await prisma.brandAsset.deleteMany({ where: { propertyId, kind: "booking_logo" } });
  await prisma.property.update({ where: { id: propertyId }, data: { bookingLogoUrl: null } });
  await logAudit(propertyId, tenantId, { entity: "Booking engine", field: "logo", newValue: "removed" });
  revalidatePath("/booking-engine");
}

/* ---------------------------------------------------------------------------------------------
 * Stripe Connect — the hotel's own account (spec §2.5③).
 *
 * The money never touches us: the guest's card is authorised against the hotel's account and funds
 * settle to the hotel. That is what keeps us out of payment-institution licensing, and the reason
 * this screen sends the hotel to Stripe rather than collecting anything itself.
 *
 * Until `chargesEnabled` is true the booking engine runs in request-to-book mode. That is the
 * important half: a hotel starts selling on day one and only *loses the instant confirmation* until
 * its paperwork clears, instead of being blocked behind a verification queue it does not control.
 * ------------------------------------------------------------------------------------------- */

/** Start (or resume) onboarding. Returns a one-time Stripe URL for the browser to follow. */
export async function startStripeOnboarding(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const scopeError = await assertSingleProperty();
  if (scopeError) return { ok: false, error: scopeError };
  const property = await getProperty();

  let accountId = property.stripeAccountId;
  if (!accountId) {
    const created = await createConnectAccount({
      propertyName: property.name,
      email: property.contactEmail,
      /*
       * ⚠ Hardcoded, and it must not stay that way.
       *
       * Stripe fixes an account's country at creation and it is IMMUTABLE — an account opened in
       * the wrong one has to be abandoned and redone, with the hotel repeating identity checks. The
       * Property carries no country field yet, so there is nothing honest to read; BG is where the
       * first clients are. Before onboarding a hotel outside Bulgaria, add `Property.country` and
       * read it here. Deliberately not derived from `jurisdiction`, which is a tax-compliance
       * setting and would be a coincidence, not a source of truth.
       */
      country: "BG",
    });
    if (!created.ok || !created.accountId) {
      return { ok: false, error: created.error ?? "Stripe could not create the account." };
    }
    accountId = created.accountId;
    await prisma.property.update({ where: { id: property.id }, data: { stripeAccountId: accountId } });
    await logAudit(property.id, property.tenantId, {
      entity: "Booking engine", field: "stripe account", newValue: "created",
    });
  }

  const origin = process.env.CRS_ORIGIN ?? "";
  const link = await createOnboardingLink(accountId, {
    // Stripe expires these links fast. `refresh` comes back to us so we can mint another one —
    // without it, a hotel that pauses for coffee is stuck on a dead Stripe page.
    refreshUrl: `${origin}/booking-engine?stripe=refresh`,
    returnUrl: `${origin}/booking-engine?stripe=done`,
  });
  if (!link.ok || !link.url) return { ok: false, error: link.error ?? "Stripe could not start onboarding." };
  return { ok: true, url: link.url };
}

/**
 * Ask Stripe what the account can do, and store it.
 *
 * Polled rather than pushed. A webhook is the better long-term answer and writes the same field, but
 * polling works today with no public endpoint, no signing secret and no replay story — and the
 * screen calls this on load, so a hotel that finished onboarding sees the truth immediately.
 */
export async function refreshStripeStatus(): Promise<void> {
  if (await assertSingleProperty()) return;
  const property = await getProperty();
  if (!property.stripeAccountId) return;

  const status = await getConnectStatus(property.stripeAccountId);
  await prisma.property.update({
    where: { id: property.id },
    data: { stripeChargesEnabled: status.chargesEnabled, stripeCheckedAt: new Date() },
  });
  revalidatePath("/booking-engine");
}

/**
 * Accept a request-to-book: it becomes a real reservation.
 *
 * The room was already occupied by the request (`ROOM_OCCUPYING_STATUSES`), so accepting changes no
 * availability and needs no re-check — which is exactly why requests hold inventory in the first
 * place. Declining is the case that frees a room, and that one re-pushes.
 */
export async function acceptBookingRequest(reservationId: string): Promise<{ ok: boolean; error?: string }> {
  const scopeError = await assertSingleProperty();
  if (scopeError) return { ok: false, error: scopeError };
  const property = await getProperty();

  const updated = await prisma.reservation.updateMany({
    where: { id: reservationId, propertyId: property.id, status: "requested" },
    data: { status: "confirmed" },
  });
  if (updated.count === 0) return { ok: false, error: "That request has already been answered." };

  await logAudit(property.id, property.tenantId, {
    entity: "Reservation", field: "status", newValue: "confirmed (request accepted)",
  });
  revalidatePath("/reservations");
  return { ok: true };
}

/** Decline a request — the room goes back on sale, everywhere, immediately. */
export async function declineBookingRequest(reservationId: string): Promise<{ ok: boolean; error?: string }> {
  const scopeError = await assertSingleProperty();
  if (scopeError) return { ok: false, error: scopeError };
  const property = await getProperty();

  const updated = await prisma.reservation.updateMany({
    where: { id: reservationId, propertyId: property.id, status: "requested" },
    data: { status: "cancelled" },
  });
  if (updated.count === 0) return { ok: false, error: "That request has already been answered." };

  await logAudit(property.id, property.tenantId, {
    entity: "Reservation", field: "status", newValue: "cancelled (request declined)",
  });
  // A declined request releases a room that was off sale. Every channel has to hear about that, and
  // hear about it now — a room the hotel just freed is the one most likely to sell tonight.
  try { await syncRealChannels(prisma, property.id); } catch { /* never fail the decline on a push */ }
  revalidatePath("/reservations");
  return { ok: true };
}
