import type { SettingsSection } from "@revio/ui/settings-nav";

/** The Settings sections, in the order they appear. Same shape as RevioLink and RevioCRS. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/property", label: "Property", blurb: "Your hotel's profile and who may use it — both shared across the platform" },
  { href: "/settings/operations", label: "Operations", blurb: "Rooms, the minibar catalogue and the night audit" },
  { href: "/settings/connections", label: "Connections", blurb: "The channels this property sells on" },
  { href: "/settings/account", label: "Your account", blurb: "Two-factor authentication and your sessions" },
];

/** Linked rather than moved — each owns a URL that support answers already point at. */
export const SETTINGS_ELSEWHERE: SettingsSection[] = [
  { href: "/rooms", label: "Rooms & units", blurb: "The physical rooms and their types" },
  { href: "/minibar/catalog", label: "Minibar / POS", blurb: "What can be posted to a folio" },
  { href: "/closeday", label: "Close Day", blurb: "Roll the business date" },
  { href: "/help", label: "Help & support", blurb: "Answers, and every request you have sent us" },
];
