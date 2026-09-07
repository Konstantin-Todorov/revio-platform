/**
 * The three staff products, and which of them a hotel may open.
 *
 * Pure and here because "one login, every product you bought" is the platform's central claim and it
 * should be answered in one place. The apps only render what this returns.
 *
 * ⚠️ No origins in this file. `packages/core` reads no environment by rule, and a URL is deployment
 * configuration rather than domain knowledge — the caller supplies it. See `product-links.ts` in
 * `@revio/ui` for the server-side half.
 */

export type ProductKey = "cm" | "crs" | "pms";

export interface ProductEntitlements {
  hasChannelManager: boolean;
  hasReservation: boolean;
  hasPms: boolean;
}

export interface ProductInfo {
  key: ProductKey;
  /** The market name a hotel recognises. */
  name: string;
  /** What it is for, in the hotel's words — five or six words, for a menu row. */
  tagline: string;
}

/**
 * Ordered the way the platform sells: distribution, then the booking record, then operations.
 *
 * Not arbitrary and not alphabetical — a hotel that bought RevioLink thinks of RevioLink as "the
 * system", so it is first wherever the three are listed together.
 */
export const PRODUCTS: readonly ProductInfo[] = [
  { key: "cm", name: "RevioLink", tagline: "Channels and availability" },
  { key: "crs", name: "RevioCRS", tagline: "Reservations and rates" },
  { key: "pms", name: "RevioPMS", tagline: "Front desk and housekeeping" },
];

export const PRODUCT_BY_KEY: Record<ProductKey, ProductInfo> = Object.fromEntries(
  PRODUCTS.map((p) => [p.key, p]),
) as Record<ProductKey, ProductInfo>;

/** Only what this hotel actually bought. An entitlement is the licence, so this is the whole gate. */
export function entitledProducts(e: ProductEntitlements): ProductInfo[] {
  return PRODUCTS.filter(
    (p) =>
      (p.key === "cm" && e.hasChannelManager) ||
      (p.key === "crs" && e.hasReservation) ||
      (p.key === "pms" && e.hasPms),
  );
}

/**
 * The product an invited owner should be sent to first.
 *
 * Their account works on every product they own; this only decides which door the email opens.
 * Falls back to RevioPMS so the return type stays non-null — a tenant with no entitlement at all
 * cannot sign in anywhere, and that is a provisioning fault to fix rather than a link to choose.
 */
export function primaryProduct(e: ProductEntitlements): ProductInfo {
  return entitledProducts(e)[0] ?? PRODUCT_BY_KEY.pms;
}

/**
 * Is there anywhere else to go?
 *
 * A hotel that bought one product should see no switcher at all — a menu offering a single
 * destination that is the page you are already on is noise pretending to be a feature.
 */
export function hasOtherProducts(e: ProductEntitlements, current: ProductKey): boolean {
  return entitledProducts(e).some((p) => p.key !== current);
}
