import type { SettingsSection } from "@revio/ui/settings-nav";
import type { SettingsStrings } from "@/lib/i18n/settings";

/** The Settings sections, in the order they appear. Same shape as RevioLink and RevioCRS. */
const SECTIONS = [
  { href: "/settings/property", key: "property" },
  { href: "/settings/emails", key: "emails" },
  { href: "/settings/operations", key: "operations" },
  { href: "/settings/connections", key: "connections" },
  { href: "/settings/billing", key: "billing" },
  { href: "/settings/account", key: "account" },
] as const;

/** Linked rather than moved — each owns a URL that support answers already point at. */
const ELSEWHERE = [
  { href: "/rooms", key: "rooms" },
  { href: "/minibar/catalog", key: "catalog" },
  { href: "/closeday", key: "closeday" },
  { href: "/help", key: "help" },
] as const;

/** Where `/settings` lands. */
export const FIRST_SECTION_HREF = SECTIONS[0].href;

export function settingsSections(t: SettingsStrings): { sections: SettingsSection[]; elsewhere: SettingsSection[] } {
  return {
    // Guest emails has pages below it (one per email); the nav stays on it while you edit one.
    sections: SECTIONS.map((s) => ({ href: s.href, ...t.sections[s.key], ...(s.key === "emails" ? { prefix: true } : {}) })),
    elsewhere: ELSEWHERE.map((s) => ({ href: s.href, ...t.elsewhere[s.key] })),
  };
}
