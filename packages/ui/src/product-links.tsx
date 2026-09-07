import "server-only";
import { entitledProducts, type ProductEntitlements, type ProductKey } from "@revio/core";

/**
 * Where each product lives, resolved on the SERVER.
 *
 * Origins are deployment configuration, not domain knowledge, so `@revio/core` — which reads no
 * environment by rule — holds the product list and this holds the addresses.
 *
 * It must be server-side for a plainer reason too: the account menu is a client component, and a
 * client component can only read `NEXT_PUBLIC_*`. Resolving here and passing the finished links down
 * as props keeps the hostnames out of the browser bundle and avoids inventing four new public
 * variables for something Railway already provides.
 *
 * **Railway injects `RAILWAY_SERVICE_<NAME>_URL` for every sibling service into every service**, so
 * the default path needs no configuration at all and a new environment inherits correct links. The
 * explicit `REVIO*_ORIGIN` variables still win, so a custom domain is one variable rather than a
 * deploy.
 */

const RAILWAY_VAR: Record<ProductKey, string> = {
  cm: "RAILWAY_SERVICE_CHANNEL_MANAGER_URL",
  crs: "RAILWAY_SERVICE_RESERVATION_URL",
  pms: "RAILWAY_SERVICE_PMS_URL",
};

const EXPLICIT_VAR: Record<ProductKey, string> = {
  cm: "REVIOLINK_ORIGIN",
  crs: "REVIOCRS_ORIGIN",
  pms: "REVIOPMS_ORIGIN",
};

const FALLBACK: Record<ProductKey, string> = {
  cm: "https://cm.reviosoft.app",
  crs: "https://crs.reviosoft.app",
  pms: "https://pms.reviosoft.app",
};

export function productOrigin(key: ProductKey): string {
  const explicit = process.env[EXPLICIT_VAR[key]]?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Railway gives a bare hostname, not a URL.
  const host = process.env[RAILWAY_VAR[key]]?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return FALLBACK[key];
}

export interface ProductLink {
  key: ProductKey;
  name: string;
  tagline: string;
  href: string;
  /** The product this menu is being rendered inside. */
  current: boolean;
}

/**
 * The products this hotel can open, with the one they are already in marked.
 *
 * Returns an empty array when there is nowhere else to go, so a single-product hotel renders no
 * switcher at all rather than a menu whose only destination is the page they are on.
 */
export function productLinks(e: ProductEntitlements, current: ProductKey): ProductLink[] {
  const owned = entitledProducts(e);
  if (owned.every((p) => p.key === current)) return [];
  return owned.map((p) => ({
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    href: productOrigin(p.key),
    current: p.key === current,
  }));
}
