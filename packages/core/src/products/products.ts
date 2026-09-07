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

/**
 * The products this hotel has NOT bought, with a reason drawn from what they already run.
 *
 * ## Why the reason is specific rather than a slogan
 *
 * "Try RevioPMS!" is an advert and gets ignored. What makes an argument is naming the thing they
 * already do and what the missing product would do with it — a hotel on RevioLink already has
 * channel bookings arriving, so the case for RevioCRS is *those bookings*, not a feature list. The
 * shared core is what makes that true rather than a sales line: the data is already there.
 *
 * Differentiated by **entitlement**, which costs no query. Usage-based wording — their actual
 * commission last month, their real direct share — is a better argument still, and needs numbers a
 * layout cannot afford to fetch on every page load. That belongs on a screen someone opens
 * deliberately.
 *
 * ## Why there is no "Buy now"
 *
 * A hotel cannot switch a product on themselves; an entitlement is flipped by the operator. Offering
 * a button that cannot complete is worse than offering none, so the honest call to action is to ask
 * us — and that is what the UI says.
 */
export interface ProductUpsell extends ProductInfo {
  /** One sentence, in the hotel's terms, about what they already have. */
  reason: string;
}

export function unownedProducts(e: ProductEntitlements): ProductUpsell[] {
  const owned = new Set(entitledProducts(e).map((p) => p.key));
  if (owned.size === 0) return [];

  return PRODUCTS.filter((p) => !owned.has(p.key)).map((p) => ({
    ...p,
    reason: upsellReason(p.key, owned),
  }));
}

function upsellReason(key: ProductKey, owned: ReadonlySet<ProductKey>): string {
  if (key === "cm") {
    return owned.has("crs")
      ? "Send the rates you already keep here straight to Booking.com and Expedia."
      : "Keep your rooms and prices in step across every booking site.";
  }
  if (key === "crs") {
    return owned.has("cm")
      ? "Your channel bookings already arrive — this is where they become a record you can report on."
      : "One reservation record, with occupancy, ADR and RevPAR computed from it.";
  }
  return owned.has("crs")
    ? "Run the arrival day on the same bookings: front desk, housekeeping and the guest's bill."
    : "Front desk, housekeeping and folios on the rooms you already have here.";
}
