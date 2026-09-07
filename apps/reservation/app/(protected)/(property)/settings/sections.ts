/**
 * The Settings sections, in the order they appear.
 *
 * One list, used by the nav and by nothing else — but kept out of the layout so that adding a
 * section is a one-line change in a file whose whole job is that list, rather than an edit inside
 * JSX. Every future setting now has an obvious home, which was the point of splitting the page.
 */
export interface SettingsSection {
  href: string;
  label: string;
  /** What a person is looking for when they land here. Shown under the heading. */
  blurb: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/property", label: "Property", blurb: "Name, timezone, currency, check-in and check-out" },
  { href: "/settings/policies", label: "Rates & policies", blurb: "Standing defaults applied when nothing more specific does, and how you price rooms" },
  { href: "/settings/taxes", label: "Taxes & fees", blurb: "What is added to a stay, and how it is shown to the guest" },
  { href: "/settings/users", label: "Users & permissions", blurb: "Roles, and the people assigned to them on the one shared Revio identity" },
  { href: "/settings/account", label: "Your account", blurb: "Two-factor authentication and your sessions" },
];

/**
 * Settings that live on their own screens.
 *
 * Linked rather than moved: each already owns a URL that support answers and bookmarks point at, and
 * breaking those to tidy a menu is a poor trade. The nav's job is that somebody looking for a
 * setting finds it — not that every setting is rendered inside this route.
 */
export const SETTINGS_ELSEWHERE = [
  { href: "/booking-engine", label: "Booking engine", blurb: "Branding, hero image and the direct-booking page" },
  { href: "/rates", label: "Rates & restrictions", blurb: "Prices, rate plans and restriction rules" },
  { href: "/distribution", label: "Distribution", blurb: "Channels and cost of distribution" },
];
