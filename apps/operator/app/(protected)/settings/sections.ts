import type { SettingsSection } from "@revio/ui/settings-nav";

/** The Settings sections, in the order they appear. Same shape as the three hotel products. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/account", label: "Your account", blurb: "Who you are here, your second factor and your sessions" },
  { href: "/settings/company", label: "Company details", blurb: "Who we are on every invoice we send a hotel" },
  { href: "/settings/staff", label: "Operator staff", blurb: "The people with access to every hotel on the platform" },
  { href: "/settings/platform", label: "Platform", blurb: "How the platform is put together" },
];

/** Linked rather than moved — each owns a URL this console already points at. */
export const SETTINGS_ELSEWHERE: SettingsSection[] = [
  { href: "/connectivity", label: "Connectivity", blurb: "Channex keys and per-tenant credentials" },
  { href: "/plans", label: "Plans & pricing", blurb: "What everything costs, computed by the code that invoices it" },
  { href: "/health", label: "Platform Health", blurb: "Jobs, sync and errors across every hotel" },
  { href: "/support", label: "Support queue", blurb: "What hotels have asked, and what is late" },
];
