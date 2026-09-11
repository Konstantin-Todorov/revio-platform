import type { SettingsSection } from "@revio/ui/settings-nav";

/**
 * The Settings sections, in the order they appear.
 *
 * One list, kept out of the layout so that adding a section is a one-line change in a file whose
 * whole job is that list. Every future setting now has an obvious home, which was the point of
 * splitting the page.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/property", label: "Property", blurb: "Your hotel's details, and the properties on this account" },
  { href: "/settings/delivery", label: "Bookings & email", blurb: "Where channel bookings are sent, the daily arrivals summary, and the mail your guests receive" },
  { href: "/settings/team", label: "Team", blurb: "The people on this account and what they may do" },
  { href: "/settings/billing", label: "Billing", blurb: "What you pay, and every invoice we have issued" },
  { href: "/settings/account", label: "Your account", blurb: "Two-factor authentication and your sessions" },
];

/** Linked rather than moved — each already owns a URL that support answers point at. */
export const SETTINGS_ELSEWHERE: SettingsSection[] = [
  { href: "/settings/emails", label: "Guest emails", blurb: "Your branding, and the wording of every email your guests receive" },
  { href: "/users", label: "Users", blurb: "Add, edit and deactivate the people on this account" },
  { href: "/channels", label: "Channels", blurb: "Connect an OTA and map your rooms and rates" },
  { href: "/rooms-rates", label: "Rooms & rates", blurb: "Room types, rate plans and prices" },
  { href: "/help", label: "Help & support", blurb: "Answers, and every request you have sent us" },
];
