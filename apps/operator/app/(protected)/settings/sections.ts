import type { SettingsSection } from "@revio/ui/settings-nav";

/** The Settings sections, in the order they appear. Same shape as the three hotel products. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/account", label: "Your account", blurb: "Who you are here, your second factor and your sessions" },
  { href: "/settings/company", label: "Company details", blurb: "Who we are on every invoice, and which VAT registration we hold" },
  { href: "/settings/staff", label: "Operator staff", blurb: "The people with access to every hotel on the platform" },
  { href: "/settings/platform", label: "Platform", blurb: "How the platform is put together" },
];

/** Linked rather than moved — each owns a URL this console already points at. */
export const SETTINGS_ELSEWHERE: SettingsSection[] = [
  // Above Connectivity because it is the wider question: this is every service we depend on, while
  // Connectivity is the one hotel-by-hotel exception inside it.
  { href: "/integrations", label: "Integrations", blurb: "Stripe, email and everything else Revio connects to" },
  { href: "/connectivity", label: "Connectivity", blurb: "Channex keys and per-tenant credentials" },
  { href: "/plans", label: "Plans & pricing", blurb: "What everything costs, computed by the code that invoices it" },
  { href: "/health", label: "Platform Health", blurb: "Jobs, sync and errors across every hotel" },
  { href: "/support", label: "Support queue", blurb: "What hotels have asked, and what is late" },
];
