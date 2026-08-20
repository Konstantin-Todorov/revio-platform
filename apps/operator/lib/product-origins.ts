import "server-only";

/**
 * Where each hotel-facing product lives.
 *
 * The operator console has to build links into apps it is not part of — an owner's invitation must
 * land on the product they actually bought, not on our console, which they can never sign into.
 *
 * Environment-overridable with the current Railway hostnames as defaults, so a rename is one
 * variable rather than a deploy. Same pattern as the CRS's `BOOKING_ENGINE_ORIGIN`.
 */
const DEFAULTS = {
  cm: "https://cm.reviosoft.app",
  crs: "https://crs.reviosoft.app",
  pms: "https://pms.reviosoft.app",
} as const;

export interface Entitlements {
  hasChannelManager: boolean;
  hasReservation: boolean;
  hasPms: boolean;
}

export function originFor(product: keyof typeof DEFAULTS): string {
  const env =
    product === "cm"
      ? process.env.REVIOLINK_ORIGIN
      : product === "crs"
        ? process.env.REVIOCRS_ORIGIN
        : process.env.REVIOPMS_ORIGIN;
  return (env ?? DEFAULTS[product]).replace(/\/$/, "");
}

/**
 * The product an invited owner should be sent to first.
 *
 * RevioLink before RevioCRS before RevioPMS — not arbitrary: it matches the order the platform sells
 * in, so a hotel that bought distribution lands on distribution. The account works on every product
 * they own regardless; this only decides which door the email opens.
 */
export function primaryProduct(e: Entitlements): { key: keyof typeof DEFAULTS; name: string; origin: string } {
  if (e.hasChannelManager) return { key: "cm", name: "RevioLink", origin: originFor("cm") };
  if (e.hasReservation) return { key: "crs", name: "RevioCRS", origin: originFor("crs") };
  return { key: "pms", name: "RevioPMS", origin: originFor("pms") };
}
