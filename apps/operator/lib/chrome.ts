import "server-only";
import { forSystem } from "@revio/db";
import type { ChromeCreate, ChromeStrings, ChromeTab } from "@revio/ui/app-chrome";

/**
 * The console's bottom bar and "+ New" on a phone. English, like the rest of the console.
 *
 * Only Client can be created by hand: invoices are generated, and "Issue" acts on a draft that
 * already exists. The number on Health is the platform's unresolved errors, every hotel included.
 */
export async function operatorChrome(): Promise<{ tabs: ChromeTab[]; create: ChromeCreate[]; strings: ChromeStrings }> {
  const errors = await forSystem().errorItem.count({ where: { resolved: false } });
  return {
    tabs: [
      { href: "/overview", label: "Overview", icon: "home" },
      { href: "/clients", label: "Clients", icon: "building" },
      { href: "/health", label: "Health", icon: "health", badge: errors },
    ],
    create: [{ href: "/clients?new=client", label: "Client", icon: "building" }],
    strings: { more: "More", create: "New", createHeading: "Create", close: "Close", back: "Back", menu: "Main screens" },
  };
}

/** Screen names for the phone's top bar, from the same navigation the menu is built from. */
export const OPERATOR_TITLES = [
  { href: "/overview", label: "Overview" }, { href: "/clients", label: "Clients" }, { href: "/leads", label: "Demo requests" },
  { href: "/support", label: "Support" }, { href: "/plans", label: "Plans & pricing" }, { href: "/billing", label: "Billing" },
  { href: "/health", label: "Platform health" }, { href: "/errors", label: "Error log" }, { href: "/auth-log", label: "Auth log" },
  { href: "/integrations", label: "Integrations" }, { href: "/connectivity", label: "Connectivity" },
  { href: "/analytics", label: "Product analytics" }, { href: "/website", label: "Website" },
  { href: "/platform-history", label: "Platform history" }, { href: "/settings", label: "Settings" },
];
