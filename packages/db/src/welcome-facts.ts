// No `server-only` here, unlike the apps' own wrappers around it. This module is re-exported from
// `@revio/db`'s barrel, which non-Next consumers (the connectivity package and its tests) import —
// and `server-only` has no resolution outside a Next build, so it would break them. The server
// boundary is enforced where it belongs: each app's `lib/welcome.ts`.
import { totalRooms, type ProductName, type WelcomeFacts } from "@revio/core";
import type { forTenant } from "./rls.js";

/**
 * The caller's client, typed as what `forTenant` actually returns rather than the bare
 * `PrismaClient`. Every app hands us an RLS-scoped extended client, so this is the honest type — and
 * it keeps the tenant guarantee at the boundary instead of accepting anything that looks like Prisma.
 */
type ScopedPrisma = ReturnType<typeof forTenant>;

/**
 * Read the state of the shared core, so the first-run flow knows what it does NOT need to ask.
 *
 * Lives here rather than in an app because all three products need the identical answer and apps may
 * never import one another. It is the query half of `welcomeFlow` — that function is pure and stays
 * that way; this one talks to Postgres and decides nothing.
 *
 * The `prisma` argument is the caller's tenant-scoped client, so RLS applies exactly as it does
 * everywhere else. Nothing here escapes a tenant.
 */

/** What "this hotel filled in its own details" means — beyond the name the operator typed. */
function propertyDetailsComplete(p: { address: string | null; contactEmail: string | null }): boolean {
  return Boolean(p.address?.trim() && p.contactEmail?.trim());
}

/**
 * What a legal invoice needs from the issuer.
 *
 * All three or none: an invoice carrying a company name but no VAT number is not a lesser invoice,
 * it is one that will be rejected. There is no partial credit here, so there is no partial `true`.
 */
function invoiceIdentityComplete(c: {
  invoiceIssuerName: string | null;
  invoiceVatId: string | null;
  invoiceAddress: string | null;
} | null): boolean {
  if (!c) return false;
  return Boolean(c.invoiceIssuerName?.trim() && c.invoiceVatId?.trim() && c.invoiceAddress?.trim());
}

export async function getWelcomeFacts(
  prisma: ScopedPrisma,
  propertyId: string,
  entitlements: { hasChannelManager: boolean; hasReservation: boolean; hasPms: boolean },
  self: ProductName,
): Promise<WelcomeFacts> {
  const [property, roomTypes, units, rates, taxes, staff, config] = await Promise.all([
    prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        address: true,
        contactEmail: true,
        emailSenderName: true,
        emailBrandColor: true,
        emailLogoUrl: true,
        reservationEmailPrimary: true,
      },
    }),
    prisma.roomType.findMany({ where: { propertyId }, select: { totalRooms: true } }),
    prisma.unit.count({ where: { propertyId, active: true } }),
    prisma.ratePrice.count({ where: { propertyId } }),
    prisma.taxFee.count({ where: { propertyId, active: true } }),
    // The Owner the operator created does not count as "they added their team".
    prisma.user.count({ where: { active: true } }),
    prisma.propertyDefaults.findUnique({
      where: { propertyId },
      select: { invoiceIssuerName: true, invoiceVatId: true, invoiceAddress: true },
    }),
  ]);

  return {
    rooms: totalRooms(roomTypes),
    hasPropertyDetails: propertyDetailsComplete(property),
    hasRoomTypes: roomTypes.length > 0,
    hasUnits: units > 0,
    hasRates: rates > 0,
    // Any one of the three is enough to say they have been to this screen — a hotel that set a
    // colour and no logo has personalised its mail, and re-asking would be pedantry.
    hasBrand: Boolean(property.emailSenderName || property.emailBrandColor || property.emailLogoUrl),
    hasTaxes: taxes > 0,
    hasInvoiceIdentity: invoiceIdentityComplete(config),
    hasReservationDelivery: Boolean(property.reservationEmailPrimary?.trim()),
    hasStaff: staff > 1,
    alsoRuns: otherProducts(entitlements, self),
  };
}

/**
 * The products this hotel runs *besides* the one it is being onboarded into.
 *
 * Entitlements, not usage: a hotel that has paid for RevioCRS and never opened it still shares the
 * same records, and telling them their rooms carry over is true before they look.
 */
export function otherProducts(
  entitlements: { hasChannelManager: boolean; hasReservation: boolean; hasPms: boolean },
  self: ProductName,
): ProductName[] {
  const owned: ProductName[] = [];
  if (entitlements.hasChannelManager) owned.push("RevioLink");
  if (entitlements.hasReservation) owned.push("RevioCRS");
  if (entitlements.hasPms) owned.push("RevioPMS");
  return owned.filter((p) => p !== self);
}
