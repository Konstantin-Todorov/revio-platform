import "server-only";
import { primaryProduct as corePrimaryProduct, type ProductEntitlements } from "@revio/core";
import { productOrigin, type ProductLink } from "@revio/ui/product-links";

/**
 * Where each hotel-facing product lives — now a thin delegation, not a second implementation.
 *
 * This file used to carry its own product list, its own ordering rule and its own environment
 * lookup. When the account menu needed the same three facts, that would have become two copies of a
 * decision that must never disagree: an invitation email sending an owner to one address while the
 * switcher sends them to another is a support call nobody can reproduce.
 *
 * The list and the ordering now live in `@revio/core` (pure, tested) and the addresses in
 * `@revio/ui/product-links` (server-side, because origins are deployment configuration). Same
 * exports as before, so callers are unchanged.
 */

export type Entitlements = ProductEntitlements;
export type { ProductLink };

export const originFor = productOrigin;

/**
 * The product an invited owner should be sent to first — RevioLink, then RevioCRS, then RevioPMS.
 *
 * Their account works on every product they own; this only decides which door the email opens.
 */
export function primaryProduct(e: Entitlements): { key: "cm" | "crs" | "pms"; name: string; origin: string } {
  const p = corePrimaryProduct(e);
  return { key: p.key, name: p.name, origin: productOrigin(p.key) };
}
